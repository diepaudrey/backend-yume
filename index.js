require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const app = express();
const PORT = process.env.PORT;

//Our Database Config
const DB_HOST = process.env.DB_HOST;
const DB_DATABASE = process.env.DB_DATABASE;
const DB_USERNAME = process.env.DB_USERNAME;
const DB_PASSWORD = process.env.DB_PASSWORD;

//Connection to MySQL database
const db = mysql.createConnection({
    user: DB_USERNAME,
    password: DB_PASSWORD,
    host: DB_HOST,
    database: DB_DATABASE,
  });

db.connect((err) => {
  if (err) {
    console.error('Erreur de connexion à la base de données : ' + err.stack);
  } else {
    console.log('Connecté à la base de données MySQL en tant qu\'ID ' + db.threadId);
  }
});


app.get('/daily_question', function (req, res) {
    const query = "SELECT * FROM daily_question";
    db.query(query, (error, results) => {
    if (error) {
      console.error('Erreur lors de l\'exécution de la requête : ' + error.stack);
      res.status(500).json({ error: 'Erreur lors de l\'exécution de la requête.' });
      return;
    }
    res.status(200).json(results);
  });
});

app.listen(PORT, function() {
    console.log('Restful API is running on PORT 3000');
   });