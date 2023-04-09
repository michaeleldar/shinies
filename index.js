const express = require('express');
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const fs = require('fs');

let URL = 'https://v2.shinies.space/'; // * change on prod

const app = express();
app.use(cookieParser());

app.use((req, res, next) => {
  res.quickRender = (header, content) => {
    res.send(`<h1>${header}</h1><p>${content}</p>`);
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

app.get('/', (req, res) => {
  res.quickRender('Welcome to Shinies!', 'Head over to <a href="/auth">/auth</a> to get started.');
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
        res.quickRender('Authentication Failed', 'You can try again <a href="/auth">right here</a>.');
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
  res.status(500).quickRender('Oh noes!', 'Seems like our website ran into an error! Please try again in 5 minutes, and contact the owner if it persists.');
});

app.listen(3000, () => {
  console.log('server started');
});