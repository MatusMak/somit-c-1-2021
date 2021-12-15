// Express is a library that will give us ability
// to easily write our REST API
const express = require('express');
// CORS is a middleware that will make it possible to call API from browser
// Learn more https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
const cors = require('cors');
// Morgan is a logging middleware
const morgan = require('morgan');
// LowDB is a file-based JSON database.
// We are using version 1.0.0 as latest 3.0.0 requires
// a bit different syntax and I want to keep things
// as simple as possible
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

// Initialize database. If file does not exist, default
// dataset will be used to create it.
const adapter = new FileSync('db.json');
const db = low(adapter);
db.defaults({
    articles: [],
    author: {
        name: 'Janko Hraško',
        email: 'janko.hrasko@example.com',
        // INSECURE!!!!
        password: 'Password1!',
        avatar: 'https://pbs.twimg.com/profile_images/3420699490/e276a23510fd1b5d5b8dbc0933e4aebb.jpeg',
    },
}).write();

// We will create an express application that we can
// start building. This is not yet exposed to the network.
// We will also mark port number for convenience.
const app = express();
const port = 9001;

// In this section, we will apply each middleware to the application
// - cors to enable accessing API in the browser from any URL
// - morgan to log incoming traffic
// - express.json to parse JSON request bodies to JavaScript objects
app.use(cors());
app.use(morgan('common'));
app.use(express.json());

// Our custom middleware to verify whether user is authenticated.
// This middleware is then attached to protected endpoints.
const checkAuth = (req, res, next) => {
    if (req.headers.authorization) {
        const authHeaders = req.headers.authorization.split(' ');
        const authorization = Buffer.from(authHeaders[1], 'base64').toString('utf-8');
        const [email, password] = authorization.split(':');
        
        const author = db.get('author').value();

        // Very dummy way of checking password - this will be enhanced in next seminar
        if (author.email === email && author.password === password) {
            next();
        } else {
            res.status(401).json();
        }
    } else {
        res.status(401).json();
    }
};

// This function will take request body and turn it into
// a new article
const createArticle = body => ({
    id: Math.floor(Math.random() * (10000 - 1) + 1),
    title: body.title,
    date: new Date().toLocaleString(),
    banner: body.banner,
    text: body.text,
    views: 0,
    comments: [],
});

// This function will create a new object representing old
// article updated by data from request
const updateArticle = (article, body) => ({
    ...article,
    title: body.title,
    banner: body.banner,
    text: body.text,
});

// This function will take request body and turn it into a new comment
const createComment = body => ({
    id: Math.floor(Math.random() * (10000 - 1) + 1),
    date: new Date().toLocaleString(),
    author: body.author,
    text: body.text,
});

// Heartbeat
app.get('/', (req, res) => {
    res.json({ status: 'OK!' });
});

// Author
app.get('/author', (req, res) => {
    const author = db.get('author').value();
    res.json(author);
});

// Articles
app.get('/articles', (req, res) => {
    const articles = db.get('articles').value();
    res.json(articles);
});

app.post('/articles', checkAuth, (req, res) => {
    const data = req.body;
    const article = createArticle(data);

    db.get('articles').push(article).write();

    // 201 CREATED
    res.status(201).json(article);
});

app.get('/articles/:id', (req, res) => {
    // Find existing article by its ID
    const article = db.get('articles').find(x => x.id == req.params.id).value();
    
    if (article) {
        article.views++;
        db.write();

        res.json(article);
    } else {
        // 404 NOT FOUND
        res.status(404).json();
    }
});

app.put('/articles/:id', checkAuth, (req, res) => {
    // Find existing article by its ID
    const article = db.get('articles').find(x => x.id == req.params.id).value();
    
    if (article) {
        // If it exists, create its updated version
        const data = req.body;
        const updatedArticle = updateArticle(article, data);

        // Here, we will find index of the article in the articles list
        // and then replace item on that index with updated article
        const articles = db.get('articles').value();
        const articleIndex = articles.findIndex(x => x.id === article.id);
        articles.splice(articleIndex, 1, updatedArticle);

        // Save updated articles list to database
        db.set('articles', articles).write();

        // 204 NO CONTENT
        res.status(204).json();
    } else {
        // 404 NOT FOUND
        res.status(404).json();
    }
});

app.delete('/articles/:id', checkAuth, (req, res) => {
    // Find existing article index in list by its ID
    const articles = db.get('articles').value();
    const articleIndex = articles.findIndex(x => x.id == req.params.id);

    if (articleIndex >= 0) {
        // If article exists (index is not negative),
        // remove it from the list & save to database
        articles.splice(articleIndex, 1);
        db.set('articles', articles).write();

        // 204 NO CONTENT
        res.status(204).json();
    } else {
        // 404 NOT FOUND
        res.status(404).json();
    }
});

// Comments

app.post('/articles/:id/comments', (req, res) => {
    // Find existing article by its ID
    const article = db.get('articles').find(x => x.id == req.params.id).value();

    if (article) {
        const comment = createComment(req.body);
        article.comments.push(comment);
        db.write();

        res.status(201).json(comment);
    } else {
        // 404 NOT FOUND
        res.status(404).json();
    }
});

app.delete('/articles/:articleId/comments/:commentId', checkAuth, (req, res) => {
    // Find existing article by its ID
    const article = db.get('articles').find(x => x.id == req.params.articleId).value();

    if (article) {
        // Find existing comment index in list by its ID
        const commentIndex = article.comments.findIndex(x => x.id == req.params.commentId);
    
        if (commentIndex >= 0) {
            // If article exists (index is not negative),
            // remove it from the list & save to database
            article.comments.splice(commentIndex, 1);
            db.write();
    
            // 204 NO CONTENT
            res.status(204).json();
        } else {
            // 404 NOT FOUND
            res.status(404).json();
        }
    } else {
        // 404 NOT FOUND
        res.status(404).json();
    }
});

// This will finally open application to the network.
// It will be listening on the port you have chosen.
// If firewall will be correctly configured, you would
// be able to see it even on the outside network.
// But you can always access it on the local network (localhost).
app.listen(port, () => {
    console.log(`Server started, listening at port ${port}!`);
});
