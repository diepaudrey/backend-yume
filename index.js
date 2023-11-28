require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron')
const mysql = require('mysql2');
const app = express();
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

const PORT = process.env.PORT;

// app.use(cors());
app.use(cors({
  origin: 'http://localhost:3000', // Remplacez cela par l'URL de votre application React
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));

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

/* Daily Questions */
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

const saltRound = 10;

app.post('/signup', function(req, res) {
  if (!req.body) {
    res.status(400).json({ error: 'Empty body.' });
    return;
  }


  bcrypt.hash(req.body.password, saltRound, (error,hash)=>{
    if(error){
      console.log(error)
    }
    db.execute(
      "INSERT INTO user (last_name, first_name ,email, password) VALUES (?, ?, ?, ?)", [req.body.last_name, req.body.first_name, req.body.email, hash], (error, result) => 
      {
        if (error) {
          console.error('Erreur lors de l\'exécution de la requête : ' + error.stack);
          res.status(500).json({ error: 'Erreur lors de l\'exécution de la requête.' });
          return;
        }
        res.status(200).json(result);
      }
    )
  })
})

/* ------------- JWT AUTH ---------------*/

const verifyJWT = (req, res, next) => {
  const token = req.headers["x-access-token"]; 

  if(!token){
    res.status(401).json({ message: 'Access token required' });
  } else{
    jwt.verify(token, "jwtSecret", (err, decoded)=>{
      if(err){
        console.log(err);
        res.status(403).json({auth : false, message :" You failed to authenticate"});
      }else{
        req.userId = decoded.id; 
        next();
      }
    })
  }
}

app.get('/isUserAuth', verifyJWT, (req, res) => {
  res.send("You are authenticated ! ");
})


app.post('/login', (req, res) => {

  if (!req.body || !req.body.email || !req.body.password) {
    res.status(400).json({ error: 'Missing email or password.' });
    return;
  }

  const email = req.body.email;
  const password = req.body.password;
  
  db.execute("SELECT * FROM user WHERE email = ?", [email], (error, result) => {
    if(result.length > 0){
      bcrypt.compare(password, result[0].password, (error, response) => {
        if(response){
          const id = result[0].id;
          const email = result[0].email;
          const firstName = result[0].first_name;
          const lastName = result[0].last_name;

          const token = jwt.sign({id}, "jwtSecret", {expiresIn : 300});
          const userInfo = {id, email, firstName, lastName};
          res.json({auth : true, token : token, result : userInfo});
        }else {
          res.json({auth : false, message : "Wrong username/password combination"});
        };
      })
    } else{
      res.json({auth : false, message : "No user exists"});
    }
  });
});


app.get("/quiz_question", function (req, res) {
  const query = "SELECT * FROM quiz_question WHERE question_id = 1"; 
  db.query(query, (error, results) => {
    if (error) {
      console.error('Erreur lors de l\'exécution de la requête : ' + error.stack);
      res.status(500).json({ error: 'Erreur lors de l\'exécution de la requête.' });
      return;
    }
    console.log(results);
    res.status(200).json(results);
  })
})

app.get("/quiz_answers", function (req, res) {
  const query = "SELECT * FROM quiz_answer WHERE question_id = 1"; 
  db.query(query, (error, results) => {
    if (error) {
      console.error('Erreur lors de l\'exécution de la requête : ' + error.stack);
      res.status(500).json({ error: 'Erreur lors de l\'exécution de la requête.' });
      return;
    }
    console.log(results);
    res.status(200).json(results);
  })
})


app.listen(PORT, function() {
  console.log('Restful API is running on PORT', PORT);
 });