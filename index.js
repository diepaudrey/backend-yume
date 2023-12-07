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

const verifyJWT = (req, res, next) => {
  const token = req.headers["x-access-token"]; 
  console.log('Verif token : ', token)

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

/*Useful when the app is always running */
randomInt = -1;
cron.schedule('00,05,10,15,20,25,30,35,40,45,50,55 * * * *' , ()=>{
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

function DQ_randomInt(){
  return new Promise((resolve, reject) => {
    const query = "SELECT COUNT(*) AS nbQuestions FROM daily_question";
    db.query(query, (error, results) => {
      if(error){
          console.error('Erreur lors de l\'exécution de la requête : ' + error.stack);
          reject(error);
          return;
      }
      const totalQuestions = results[0].nbQuestions;
      const randomInt = Math.floor(Math.random() * totalQuestions + 1);
      console.log("back randomint :" , randomInt);
      resolve(randomInt);
    })
  })
}

app.get('/daily_question', async function (req, res) {
  try{
  //const randomInt = await DQ_randomInt()
  const query = `SELECT * FROM daily_question WHERE id=${randomInt}`;
  db.query(query, (error, results) => {
    if (error) {
      console.error('Erreur lors de l\'exécution de la requête : ' + error.stack);
      res.status(500).json({ error: 'Erreur lors de l\'exécution de la requête.' });
      return;
    }
      res.status(200).json(results);
  });
  } catch(error){
      console.error("Erreur lors de la récupération du nombre aléatoire :", error);
      res.status(500).json({ error: 'Erreur lors de la récupération du nombre aléatoire.' }); 
  }
});


app.post('/daily_answer', verifyJWT, function (req, res) {
  if (!req.body) {
    res.status(400).json({ error: 'Empty body.' });
    return;
  }
  const questionId = randomInt;
  const userId = req.userId;

  db.execute(
    "INSERT INTO daily_answer (id_question, id_user, answer) VALUES (?, ?, ?)", [questionId, userId, req.body.answer], (error, result) => {
      if (error) {
        console.error('Erreur lors de l\'exécution de la requête : ' + error.stack);
        res.status(500).json({ error: 'Erreur lors de l\'exécution de la requête.' });
        return;
      }
      res.status(200).json(result);
    }
  )

})

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

          const token = jwt.sign({id}, "jwtSecret", {expiresIn : '24h'});
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

/*----------Quiz---------*/

let randomIntQuiz = 1;
cron.schedule('30 * * * *' , ()=>{
  const query = "SELECT COUNT(*) AS nbQuizzes FROM quizzes";
  db.query(query, (error, results) => {
    if(error){
        console.error('Erreur lors de l\'exécution de la requête : ' + error.stack);
        return;
    }
    const totalQuizzes = results[0].nbQuizzes;
    randomIntQuiz = Math.floor(Math.random() * totalQuizzes + 1);
    console.log("QUIZ back randomint :" , randomIntQuiz);
  })
})

app.get("/quiz", function (req, res) {
  console.log("id quiz : ", randomIntQuiz);
  const queryQuestions = `SELECT * FROM quiz_question WHERE quiz_id=${randomIntQuiz}`;
  const queryAnswers = "SELECT * FROM quiz_answer";

  // Utilisation de Promise.all pour exécuter les deux requêtes en parallèle
  Promise.all([
    new Promise((resolve, reject) => {
      db.query(queryQuestions, (error, questionsResults) => {
        if (error) {
          reject(error);
        } else {
          resolve(questionsResults);
        }
      });
    }),
    new Promise((resolve, reject) => {
      db.query(queryAnswers, (error, answersResults) => {
        if (error) {
          reject(error);
        } else {
          resolve(answersResults);
        }
      });
    }),
  ])
    .then(([questionsResults, answersResults]) => {
      // Construire la réponse souhaitée en combinant les questions et les réponses
      const responseData = questionsResults.map((question) => {
        return {
          quiz_id : randomIntQuiz,
          question_id: question.question_id,
          question_text: question.question_text,
          answers: answersResults
            .filter((answer) => answer.question_id === question.question_id)
            .map((filteredAnswer) => {
              return {
                answer_id: filteredAnswer.answer_id,
                answer_text: filteredAnswer.answer_text,
              };
            }),
        };
      });
      res.status(200).json(responseData);
    })
    .catch((error) => {
      console.error("Erreur lors de l'exécution des requêtes : " + error.stack);
      res.status(500).json({ error: "Erreur lors de l'exécution des requêtes." });
    });
});

app.post('/user_question_answer', verifyJWT, (req, res) => {
  const query = 'INSERT INTO user_quiz_answers (id_user, id_quiz, id_question, id_answer) VALUES (?, ?, ?, ?)';

  const id_user = req.body.id_user;
  const id_quiz = req.body.id_quiz;
  const id_question = req.body.id_question;
  const id_answer = req.body.id_answer;

  db.query(query,[id_user, id_quiz, id_question, id_answer], (error, result) => {
      if (error) {
        console.error('Erreur lors de l\'exécution de la requête : ' + error.stack);
        res.status(500).json({ error: 'Erreur lors de l\'exécution de la requête.' });
        return;
      }
      res.status(200).json(result);
  })
})


// app.get("/quiz_questions", function (req, res) {
//   const query = `SELECT * FROM quiz_question WHERE quiz_id = ${randomIntQuiz}`;
//   db.query(query, (error, results) => {
//     if (error) {
//       console.error('Erreur lors de l\'exécution de la requête : ' + error.stack);
//       res.status(500).json({ error: 'Erreur lors de l\'exécution de la requête.' });
//       return;
//     }
//     console.log("quiz questions : ", results)
//     res.status(200).json(results);
//   })
// })

// app.get("/question_answers", function (req, res) {
//   const query = `SELECT * FROM quiz_answer WHERE question_id = ${req.body.questionId}`; 
//   db.query(query, (error, results) => {
//     if (error) {
//       console.error('Erreur lors de l\'exécution de la requête : ' + error.stack);
//       res.status(500).json({ error: 'Erreur lors de l\'exécution de la requête.' });
//       return;
//     }
//     res.status(200).json(results);
//   })
// })

// app.get("/quiz_answers", function (req, res) {
//   const query = `SELECT * FROM quiz_answer WHERE question_id = ${randomIntQuiz}`; 
//   db.query(query, (error, results) => {
//     if (error) {
//       console.error('Erreur lors de l\'exécution de la requête : ' + error.stack);
//       res.status(500).json({ error: 'Erreur lors de l\'exécution de la requête.' });
//       return;
//     }
//     res.status(200).json(results);
//   })
// })


// app.get("/quiz_question", function (req, res) {
//   const query = `SELECT * FROM quiz_question WHERE question_id = ${randomIntQuiz}`; 
//   db.query(query, (error, results) => {
//     if (error) {
//       console.error('Erreur lors de l\'exécution de la requête : ' + error.stack);
//       res.status(500).json({ error: 'Erreur lors de l\'exécution de la requête.' });
//       return;
//     }
//     res.status(200).json(results);
//   })
// })






app.listen(PORT, function() {
  console.log('Restful API is running on PORT', PORT);
 });