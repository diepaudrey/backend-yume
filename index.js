require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron')
const mysql = require('mysql2');
const app = express();

const PORT = process.env.PORT;

app.use(cors());
app.use(express.json());

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


app.get('/daily_questions', function (req, res) {
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


let randomInt = -1;
cron.schedule('15,20,21,25,30 * * * *' , ()=>{
  const query = "SELECT COUNT(*) AS nbQuestions FROM daily_question";
  db.query(query, (error, results) => {
    if(error){
        console.error('Erreur lors de l\'exécution de la requête : ' + error.stack);
        return;
    }
    const totalQuestions = results[0].nbQuestions;
    randomInt = Math.floor(Math.random() * totalQuestions + 1);
    console.log("back randomint :" , randomInt);
  })
})

console.log("back randomint currently used:" , randomInt);

app.get('/daily_question', function (req, res) {
  const query = `SELECT * FROM daily_question WHERE id=${randomInt}`;
  db.query(query, (error, results) => {
  if (error) {
    console.error('Erreur lors de l\'exécution de la requête : ' + error.stack);
    res.status(500).json({ error: 'Erreur lors de l\'exécution de la requête.' });
    return;
  }
  res.status(200).json(results);
});
});

/* Login & Sign up */

app.post('/signup', function(req, res) {
  console.log("côté back c'est rentré");
  if (!req.body) {
    res.status(400).json({ error: 'Le corps de la requête est vide.' });
    return;
  }
  const query = "INSERT INTO user (last_name, first_name ,email, password) VALUES (?, ?, ?, ?)"
  const values = [req.body.last_name, req.body.first_name, req.body.email, req.body.password];

  db.query(query, values, (error, results) => {
    if (error) {
      console.error('Erreur lors de l\'exécution de la requête : ' + error.stack);
      res.status(500).json({ error: 'Erreur lors de l\'exécution de la requête.' });
      return;
    }
    res.status(200).json(results);
  });
})


app.listen(PORT, function() {
    console.log('Restful API is running on PORT 3000');
   });