const express = require('express');
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const Cryptr = require('cryptr');
const cryptr = new Cryptr(process.env.cryptrKey);
const fs = require('fs');

let URL = 'https://v2.shinies.space/'; // change on prod

const app = express();
app.use(cookieParser());

app.use((req, res, next) => {
  res.render = (header, content) => {
    res.send(`<!DOCTYPE html>
<html>
<head>
<title>${header} | Shinies</title>
<link rel="icon" type="image/png" href="/static/icon.png">
<link rel="stylesheet" href="https://unpkg.com/chota@latest">
<link rel="stylesheet" href="/static/style.css">
</head>
<body>
<h1>${header}</h1>
<p>${content}</p>
</body>`);
  }

  // TODO: res.render(html);
  // and redirect www.* to non-www

  let data;
  try {
    data = jwt.verify(req.cookies.jwt, process.env['SECRET']);
  } catch (e) {
    data = null;
  }
  res.data = data;
  
  next();
});

const cookieOptions = {
  path: '/',
  httpOnly: true,
  sameSite: 'lax',
  secure: true,
  maxAge: 7 * 24 * 3600 * 1000
}

app.use('/static', express.static(__dirname + '/static/'));

app.get('/', (req, res) => {
  res.render('Welcome to Shinies!', 'Head over to <a href="/auth">/auth</a> to get started.');
});

app.get('/api/users/:user', (req, res) => {
  return getUserInfo(req.params.user);
});

app.get('/auth', async (req, res) => {
  if (res.data) {
    res.redirect('/');
  } else {
    if (req.query.privateCode) {
      const result = await fetch('https://auth.itinerary.eu.org/api/auth/verifyToken?privateCode=' + req.query.privateCode);
      const json = await result.json();
      if (json.valid) {
        const token = jwt.sign({ name: json.username }, process.env['SECRET'], { expiresIn: '7 days' });
        res.cookie('jwt', token, cookieOptions);
        res.redirect('/');
      } else {
        res.render('Authentication Failed', 'You can try again <a href="/auth">right here</a>.');
      }
    } else {
      res.redirect(
        'https://auth.itinerary.eu.org/auth/?redirect=' +
        Buffer.from(URL).toString('base64') +
        '&name=Shinies'
      );
    }
  }
});

app.get('/logout', (req, res) => {
  res.clearCookie('jwt', cookieOptions);
  res.redirect('/');
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('Oh noes!', 'Seems like our website ran into an error! Please try again in 5 minutes, and contact the owner if it persists.');
});

function getUserInfo(name) {
  let data = JSON.parse(fs.readFileSync(__dirname + '/database.json'));
  if (!data[name]) return { exists: false };
  delete data[name].paymentKey;
  return data[name];
}

function stringifyHistory(arr) {
  let final = '';
  for (let i in arr) {
    final += '\n';
    let el = arr[i];
    if (el.type == 'paid') {
      final += `<a href="/u/${el.user}">${el.user}</a> has paid you ${el.amount} shinies`;
    }
    if (el.type == 'received') {
      final += `You paid <a href="/u/${el.user}">${el.user}</a> ${el.amount} shinies`;
    }
    final += ' ' + time_ago(el.date);
  }
  return final;
}

// https://stackoverflow.com/a/12475270
function time_ago(time) {

  switch (typeof time) {
    case 'number':
      break;
    case 'string':
      time = +new Date(time);
      break;
    case 'object':
      if (time.constructor === Date) time = time.getTime();
      break;
    default:
      time = +new Date();
  }
  var time_formats = [
    [60, 'seconds', 1], // 60
    [120, '1 minute ago', '1 minute from now'], // 60*2
    [3600, 'minutes', 60], // 60*60, 60
    [7200, '1 hour ago', '1 hour from now'], // 60*60*2
    [86400, 'hours', 3600], // 60*60*24, 60*60
    [172800, 'Yesterday', 'Tomorrow'], // 60*60*24*2
    [604800, 'days', 86400], // 60*60*24*7, 60*60*24
    [1209600, 'Last week', 'Next week'], // 60*60*24*7*4*2
    [2419200, 'weeks', 604800], // 60*60*24*7*4, 60*60*24*7
    [4838400, 'Last month', 'Next month'], // 60*60*24*7*4*2
    [29030400, 'months', 2419200], // 60*60*24*7*4*12, 60*60*24*7*4
    [58060800, 'Last year', 'Next year'], // 60*60*24*7*4*12*2
    [2903040000, 'years', 29030400], // 60*60*24*7*4*12*100, 60*60*24*7*4*12
    [5806080000, 'Last century', 'Next century'], // 60*60*24*7*4*12*100*2
    [58060800000, 'centuries', 2903040000] // 60*60*24*7*4*12*100*20, 60*60*24*7*4*12*100
  ];
  var seconds = (+new Date() - time) / 1000,
    token = 'ago',
    list_choice = 1;

  if (seconds == 0) {
    return 'Just now'
  }
  if (seconds < 0) {
    seconds = Math.abs(seconds);
    token = 'from now';
    list_choice = 2;
  }
  var i = 0,
    format;
  while (format = time_formats[i++])
    if (seconds < format[0]) {
      if (typeof format[2] == 'string')
        return format[list_choice];
      else
        return Math.floor(seconds / format[2]) + ' ' + format[1] + ' ' + token;
    }
  return time;
}

app.listen(3000, () => {
  console.log('server started');
});