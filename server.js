//index.js
//author: Jannik Renner 752776, Sonja Czernotzky 742284

//General requirements
var express = require('express');
var bodyParser = require('body-parser');
var request = require('request');
var session = require('express-session');
var cors = require('cors');
var mongoose = require('mongoose');
var fs = require('fs');
var path = require('path');
var auth = require('./auth');

//Model requirements
require('./models/Users');
require('./config/passport');

//Creating app
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);

//App use
app.use(express.static(__dirname + '/'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json())
app.use(session({ secret: 'passport-tutorial', cookie: { maxAge: 60000 }, resave: false, saveUninitialized: false }));
app.use(require('./chat'));

//Connect to mongoDB
mongoose.connect('mongodb://jannikrenner:mLbjr92@ds223578.mlab.com:23578/chatapp');
var db = mongoose.connection;
db.on("error", console.error.bind(console, "Can't connect to mongoDB"));
db.once("open", function (callback) {
    console.log("Connection to mongoDB succeeded.");
});

//Server listening and running
server.listen(process.env.PORT || 3030);
console.log('Server running on port %s', server.address().port);

//Globals
var users = [];
var connections = [];

io.sockets.on('connection', function(socket) {
    connect(socket);

    //Disconnect
    socket.on('disconnect', function (data) {
        disconnect(socket);
    });

    //Send message
    socket.on('send message', function (data) {
        parseMessage(data, socket);
    });

    //New User
    socket.on('new user', function (data, callback) {
        socket.username = data.username;
        var user = {
            id:socket.username,
            token:data.token
        };
        
        //Check if username matches regex. No whitespace is allowed. No html tags allowed.
        var regEx1 = new RegExp("[ \r\n\t\f ]");
        var regEx2 = new RegExp("<([a-z]+) *[^/]*?>");
        if(regEx1.test(data.username) || regEx2.test(data.username)){
            socket.emit("login error", "Please enter a single word for the username.")
        }else{
            //Username is provided, when log in succeeded
            if (userAlreadyExists(user.id)) {
                socket.username = null;
                socket.emit("login error", "The current username already exists. Choose another one instead.");
                callback(false);
                return;
            }else {
                users.push(user);
                notifyUserConnected(user.id);
                callback(user.id);
                updateUsers();
            }
        }        
    });

    //Add connection to connections array
    function connect(socket){
        connections.push(socket);
        console.log('Connected: %s sockets connected', connections.length);
    }

    //Remove user from users array and remove connection from connections array. Update users.
    function disconnect(socket) {
        var user;
        users.forEach(function(element){
            if(element.id == socket.username){
                user = element;
            }
        });
        if(user != null && user != undefined && user.id != undefined && userAlreadyExists(user.id)){
            //Disconnect user
            users.splice(users.indexOf(user), 1);
            updateUsers();
        } 
        //Disconnect connection              
        connections.splice(connections.indexOf(socket), 1);
        socket.emit('disconnect socket', "");
        if(socket.username != undefined) {
            notifyUserDisconnected(socket.username);
        }        
        console.log('Disconnected: %s sockets connected', connections.length);
    }

    //Update users.
    function updateUsers(){
        io.sockets.emit('get users', users);
    }

    //Notify that new user connected.
    function notifyUserConnected(username){
        var msg = username + " entered the room.";
        var timestamp = createTimestamp();
        io.sockets.emit('new message',  {type:'connected', msg:msg, fileData:null, user:socket.username, timestamp:timestamp});
    }

    //Notify that user disconnected.
    function notifyUserDisconnected(username){
        var msg = username + " left the room.";
        var timestamp = createTimestamp();
        io.sockets.emit('new message',  {type:'disconnected', msg:msg, fileData:null, user:socket.username, timestamp:timestamp});
    }

    //Parse the data object's massage to distinguis between different commands.
    function parseMessage(data, socket){

        //Check if message or file is attached. If both are missing, don't send
        if(data.msg != null && data.msg != undefined && data.msg != "" || data.fileData.file != null && data.fileData.file != undefined){
 
            //Check for javascript or html div's in msg object. Only send message if the regEx doesn't fit.
            var regEx = new RegExp("<([a-z]+) *[^/]*?>");
            
            var truthy = regEx.test(data.msg);
            if(!truthy){

                //Check if it is a list command
                if(data.msg.startsWith("/list")){   //Check if the massage is a list command.
                    socket.emit('new message', {type:'list', msg:users, fileData:data.fileData, user:socket.username, timestamp:timestamp});
                }else {
                    //get mood
                    var clientServerOptions = {
                        uri: 'https://toneanalyzer.eu-de.mybluemix.net/tone',
                        body: JSON.stringify({
                            texts: [data.msg, data.msg]
                        }),
                        method: 'POST',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json',
                            'mode': 'cors'
                        }
                    }
                    request(clientServerOptions, function (error, response) {
                        
                        var result = JSON.parse(response.body);
                        var mood = result.mood;

                        //Proceed with sending message to clients
                        var timestamp = createTimestamp();

                        if(data.msg.startsWith("/whisper")){  //CHeck if the message is a whisper command.
                            //Split username from message
                            var res = data.msg.split(":");
                            var username = res[1].split(" ", 1);
                            var msg = res[1].slice(username[0].length, res[1].length);
                            //Get socket related to username
                            var whisper_socket = connections.find(socket => socket.username == username);
                            //Send message to self and whisper user
                            if(whisper_socket){
                                whisper_socket.emit('new message',  {type:'whisper', msg:msg, mood:mood, fileData:data.fileData, user:socket.username, timestamp:timestamp});
                                socket.emit('new message',  {type:'whisper', msg:msg, mood:mood, fileData:data.fileData, user:socket.username, timestamp:timestamp});
                            }
                        }else{  //The message is no specific command. Send it to all users.
                            io.sockets.emit('new message', {type:'all', msg:data.msg, mood:mood, fileData:data.fileData, user:socket.username, timestamp:timestamp});
                        }
                    });
                }             
            }           
        }        
    }

    //Create a timestamp object with the current time in hour:minute.
    function createTimestamp(){
        var min = new Date().getMinutes();
        var minutes;
        if(min < 10){
            minutes = "0" + min;
        }else {
            minutes = min;
        }
        return timestamp = new Date().getHours() + ":" + minutes;
    }

    //Return true if user already exists
    function userAlreadyExists(userId){
        var userAlreadyExists = false;
        users.forEach(function(element) {
            if(element.id === userId){
                userAlreadyExists = true;
            }
        });
        return userAlreadyExists;
    }
});
