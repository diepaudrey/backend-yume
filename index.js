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
const req = require('express/lib/request');


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
    //const query = "SELECT * FROM daily_question";
    const query = `SELECT * FROM daily_question LEFT JOIN daily_answer ON daily_question.id=daily_answer.id_question WHERE daily_answer.id_question IS NULL OR daily_answer.id_user!=${req.userId}`

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
// let randomInt = -1;
// cron.schedule('*/2 * * * *' , ()=>{
//   const query = "SELECT COUNT(*) AS nbQuestions FROM daily_question";
//   db.query(query, (error, results) => {
//     if(error){
//         console.error('Erreur lors de l\'exécution de la requête : ' + error.stack);
//         return;
//     }
//     const totalQuestions = results[0].nbQuestions;
//     randomInt = Math.floor(Math.random() * totalQuestions + 1);
//     console.log("back randomint :" , randomInt);
//   })
// })


const getDailyQuestionIndex = async function(req, res) {
  //Get all the daily questions not answered by the current user
  try{
    const query = `SELECT daily_question.id FROM daily_question LEFT JOIN daily_answer ON daily_question.id=daily_answer.id_question WHERE daily_answer.id_question IS NULL OR daily_answer.id_user!=${req.userId}`;
    return new Promise((resolve, reject) => {
      db.query(query, (error, results) => {
        if (error) {
          console.error('Erreur lors de l\'exécution de la requête : ' + error.stack);
          reject(error);
          res.status(500).json({ error: 'Erreur lors de l\'exécution de la requête.' });
          return;
        }
          const indexArray = results.map((obj)=>obj.id);
          if (indexArray.length === 0) {
            //User has answerd to all questions
            res.status(404).json({ error: 'Aucune question trouvée.' });
            return;
          }
          const randomIndex = Math.floor(Math.random() * indexArray.length);
          const randomIntQuestion= indexArray[randomIndex];
          resolve(randomIntQuestion);
          res.status(200);
      });
    });
    
    } catch(error){
      console.error("Erreur lors de la récupération des daily questions :", error);
      res.status(500).json({ error: 'Erreur lors de la récupération des daily questions.' });
      throw error;
    }

}

app.get('/daily_question', verifyJWT, async function (req, res) {
  const randIndex = await getDailyQuestionIndex(req,res);
  const query = `SELECT id,question FROM daily_question WHERE id=${randIndex}`
  const updateQuery = `UPDATE user SET daily_question_id=${randIndex} WHERE id=${req.userId}`;

  Promise.all([
    new Promise((resolve,reject)=>{
      db.query(updateQuery, (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve({success: true});
        }
      });
    }),
    new Promise((resolve, reject) => {
      db.query(query, (error, dailyQuestion) => {
        if (error) {
          reject(error);
        } else {
          resolve(dailyQuestion);
        }
      });
    }),
  ]).then((dailyQuestion) => {
    res.status(200).json(dailyQuestion[1])
  }).catch((error) => {
    console.error("Error fetching daily question :", error);
      res.status(500).json({ error: 'Error fetching daily question.' }); 
  });
});

app.get('/is_question_answered/:id', verifyJWT, (req, res) => {
  const questionId = req.params.id;
  const userId = req.userId;
  const query = `SELECT * FROM daily_answer WHERE id_user = ? AND id_question = ?`
  db.query(query, [userId, questionId] ,(error, result) => {
    if(error){
      console.error('Erreur lors de l\'exécution de la requête : ' + error.stack);
      res.status(500).json({ error: 'Erreur lors de l\'exécution de la requête.' });
    }
    else{
      if (result.length > 0) {
        res.status(200).json({ isAnswered: true });
      } else {
        res.status(200).json({ isAnswered: false });
      }
    }
  })

})

app.get('/daily_question_id', verifyJWT, async function (req, res) {
  const queryDailyQuestionId = `SELECT daily_question_id FROM user WHERE id = ${req.userId}`
  const query = `SELECT id,question FROM daily_question WHERE id=?`;
  
  db.query(queryDailyQuestionId, (error, result) => {
    if(error){
      return res.status(500).json({error : "Error while getting user daily question id"})
    }
    console.log(result)
    const dailyQuestionId = result[0].daily_question_id;

    new Promise((resolve, reject) => {
      db.query(query, [dailyQuestionId], (error, dailyQuestion) =>{
        if(error){
          reject(error)
        }else{
          
          resolve(dailyQuestion)
        }
      })
    }).then((dailyQ) => {
      res.status(200).json(dailyQ)
    }).catch((error) => {
      console.error("Error fetching daily question :", error);
        res.status(500).json({ error: 'Error fetching daily question.' }); 
    });
  })
  // try{
  // const queryDailyQuestionId = `SELECT daily_question_id FROM user WHERE id = ${req.userId}`
  // const query = `SELECT id,question FROM daily_question WHERE id=?`;
  // Promise.all([
  //   new Promise((resolve, reject) => {
  //     db.query(queryDailyQuestionId, (error, dailyQuestionId) =>{
  //       if(error){
  //         reject(error)
  //       }else{
  //         console.log('dailyquestionid :', dailyQuestionId)
  //         resolve(dailyQuestionId)
  //       }
  //     })
  //   }),
  //   new Promise((resolve, reject) => {
  //     db.query(query, [])
  //   })
  // ])
  // db.query(query, (error, results) => {
  //   if (error) {
  //     console.error('Erreur lors de l\'exécution de la requête : ' + error.stack);
  //     res.status(500).json({ error: 'Erreur lors de l\'exé  cution de la requête.' });
  //     return;
  //   }
  //     res.status(200).json(results);
  // });
  // } catch(error){
  //     console.error("Erreur lors de la récupération du nombre aléatoire :", error);
  //     res.status(500).json({ error: 'Erreur lors de la récupération du nombre aléatoire.' }); 
  // }
});


app.post('/daily_answer', verifyJWT, function (req, res) {
  if (!req.body) {
    res.status(400).json({ error: 'Empty body.' });
    return;
  }
  const questionId = req.body.id_question;
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

app.get('/daily_answers', verifyJWT, async function (req, res) {
    const userId = req.userId
    const queryAnswers = `SELECT * FROM daily_answer WHERE id_user=${userId}`;
    const queryQuestions = "SELECT * FROM daily_question";

    Promise.all([
      new Promise((resolve, reject) => {
        db.query(queryQuestions, (error,questionsResults)=>{
          if(error){
            reject(error);
          }else{
            resolve(questionsResults);
          }
        })
      }), 

      new Promise((resolve,reject)=>{
        db.query(queryAnswers, (error, answersResults) => {
          if(error){
            reject(error);
          } else {
            resolve(answersResults);
          }
        })
      })
    ])
    .then(([questionsResults, answersResults])=>{
      const responseData = answersResults.map((answer)=>{
        return {
          answer : answer.answer,
          question : questionsResults.filter((question) => answer.id_question === question.id)[0]?.question,
        }
      })
      res.status(200).json(responseData);
    })
    .catch((error)=>{
      console.error("Erreur lors de l'exécution des requêtes : " + error.stack);
      res.status(500).json({ error: "Erreur lors de l'exécution des requêtes." });
    })
});

/*---------Login & Sign up-------------*/

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


app.post('/last_login', verifyJWT, (req, res) => {
  const userId = req.userId;
  const date = req.body.date;
  const query = `UPDATE user SET last_login=STR_TO_DATE( ?, '%Y/%m/%d') WHERE id = ?`

  db.query(query, [date, userId], (error, result) => {
    if (error) {
      console.error('Error during last login update date: ' + error.stack);
      res.status(500).json({ error: 'Error during last login update date' });
    } else {
      res.status(200).json({ success: true });
    }
  })

})

app.get('/last_login', verifyJWT, (req, res) => {
  const userId = req.userId;
  const query = "SELECT DATE_FORMAT(last_login, '%Y/%m/%d') AS last_login FROM user WHERE id = ?";
  db.query(query, [userId], (error, result) => {
    if(error){
      console.error('Error to get the last login date : ' + error.stack);
      res.status(500).json({error : 'Error to get the last login date '})
    }
    else{
      res.status(200).json(result);
    }
  })
})


app.post('/user_description', verifyJWT, (req, res) => {
  const userId= req.userId;
  const description = req.body.description;
  console.log(description);

  const query = `UPDATE user SET user.description=? WHERE user.id=?`
  db.query(query, [description, userId], (error, result) => {
    if (error) {
      console.error('Error to post user description : ' + error.stack);
      res.status(500).json({ error: 'Error to post user description' });
    } else {
      res.status(200).json({ success: true });
    }
  })
})

app.get('/user_description', verifyJWT, (req, res) => {
  const userId = req.userId;
  const query = `SELECT * FROM user WHERE user.id=?`;
  db.query(query,[userId], (error, result) => {
    if (error) {
      console.error('Error to get user description : ' + error.stack);
      res.status(500).json({ error: 'Error to get user description' });
    } else {
      res.status(200).json(result);
    }
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

const getDailyQuizIndex = async function(req, res) {
  //Get a random quiz that user did not answer yet
  try{
    const query = `SELECT quizzes.quiz_id FROM quizzes LEFT JOIN take_quiz ON quizzes.quiz_id=take_quiz.quiz_id WHERE take_quiz.quiz_id IS NULL OR take_quiz.user_id!=${req.userId}`;
    return new Promise((resolve, reject) => {
      db.query(query, (error, results) => {
        if (error) {
          console.error('Erreur lors de l\'exécution de la requête : ' + error.stack);
          reject(error);
          res.status(500).json({ error: 'Erreur lors de l\'exécution de la requête.' });
          return;
        }
          const indexArray = results.map((obj)=>obj.quiz_id);
          if (indexArray.length === 0) {
            //User has answerd to all quizzes
            res.status(404).json({ error: 'No more quizzes left' });
            return;
          }
          const randomIndex = Math.floor(Math.random() * indexArray.length);
          const randomIntQuiz= indexArray[randomIndex];
          
          resolve(randomIntQuiz);
          res.status(200);
      });
    });
    
    } catch(error){
      console.error("Erreur lors de la récupération des daily questions :", error);
      res.status(500).json({ error: 'Erreur lors de la récupération des daily questions.' });
      throw error;
    }

};

app.get("/quiz", verifyJWT, async function (req, res) {
  const randomIntQuiz = await getDailyQuizIndex(req, res);
  console.log("id quiz : ", randomIntQuiz);
  const queryUpdateQuizIndex = `UPDATE user SET daily_quiz_id = ${randomIntQuiz} WHERE id=${req.userId}`
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
    new Promise((resolve, reject) => {
      db.query(queryUpdateQuizIndex, (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve({success: true});
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

app.get("/quiz_by_id/:id", verifyJWT, async (req, res) => {
  const queryQuestions = `SELECT * FROM quiz_question WHERE quiz_id=${req.params.id}`;
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
          quiz_id : req.params.id,
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



app.get('/daily_quiz', verifyJWT, (req, res) => {
  const queryDailyQuizId = `SELECT daily_quiz_id from user WHERE id = ${req.userId}`
  const queryQuestions = `SELECT * FROM quiz_question WHERE quiz_id= ?`;
  const queryAnswers = "SELECT * FROM quiz_answer";

  db.query(queryDailyQuizId, (err, results) => {
    if(err){
      return res.status(500).json({error : "Error while getting the daily quiz id"})
    }

    const dailyQuizId = results[0].daily_quiz_id;

  // Utilisation de Promise.all pour exécuter les deux requêtes en parallèle
    Promise.all([
      new Promise((resolve, reject) => {
        db.query(queryQuestions,[dailyQuizId],(error, questionsResults) => {
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
            quiz_id : dailyQuizId,
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
  })
  
})

app.post('/user_question_answer', verifyJWT, (req, res) => {
  const query = 'INSERT INTO user_quiz_answers (id_user, id_quiz, id_question, id_answer) VALUES (?, ?, ?, ?)';

  const id_user = req.userId;
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



app.post('/take_quiz', verifyJWT, (req, res) => {
  const query = 'INSERT INTO take_quiz (user_id, quiz_id, status) VALUES (?, ?, ?)';

  const id_user = req.userId;
  const id_quiz = req.body.id_quiz;
  const status = 1;

  db.query(query,[id_user, id_quiz, status], (error, result) => {
      if (error) {
        console.error('Erreur lors de l\'exécution de la requête : ' + error.stack);
        res.status(500).json({ error: 'Erreur lors de l\'exécution de la requête.' });
        return;
      }
      res.status(200).json(result);
  })
})

app.get('/is_quiz_answered/:id', verifyJWT, (req, res) => {
  const quizId = req.params.id;
  const userId = req.userId;
  const query = `SELECT * FROM take_quiz WHERE user_id = ? AND quiz_id = ?`
  db.query(query, [userId, quizId] ,(error, result) => {
    if(error){
      console.error('Erreur lors de l\'exécution de la requête : ' + error.stack);
      res.status(500).json({ error: 'Erreur lors de l\'exécution de la requête.' });
    }
    else{
      if (result.length > 0) {
        res.status(200).json({ isAnswered: true });
      } else {
        res.status(200).json({ isAnswered: false });
      }
    }
  })

})

app.get('/quiz_answers', verifyJWT, async function (req, res) {
  const userId = req.userId
  const queryAnswers = `SELECT * FROM user_quiz_answers LEFT JOIN quiz_answer ON user_quiz_answers.id_answer=quiz_answer.answer_id WHERE user_quiz_answers.id_user =${userId}`;
  const queryQuestions = "SELECT * FROM quiz_question";

  Promise.all([
    new Promise((resolve, reject) => {
      db.query(queryQuestions, (error,questionsResults)=>{
        if(error){
          reject(error);
        }else{
          resolve(questionsResults);
        }
      })
    }), 

    new Promise((resolve,reject)=>{
      db.query(queryAnswers, (error, answersResults) => {
        if(error){
          reject(error);
        } else {
          resolve(answersResults);
        }
      })
    })
  ])
  .then(([questionsResults, answersResults])=>{
    const responseData = answersResults.map((answer)=>{
      return {
        answer : answer.answer_text,
        question : questionsResults.filter((question) => answer.id_question === question.question_id)[0]?.question_text,
      }
    })
    console.log(responseData)
    res.status(200).json(responseData);
  })
  .catch((error)=>{
    console.error("Erreur lors de l'exécution des requêtes : " + error.stack);
    res.status(500).json({ error: "Erreur lors de l'exécution des requêtes." });
  })
});


app.listen(PORT, function() {
  console.log('Restful API is running on PORT', PORT);
 });