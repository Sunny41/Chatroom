//index.js
//author: Jannik Renner 752776, Sonja Czernotzky 742284

var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);
var fs = require('fs');
var path = require('path');

app.use(express.static(__dirname + '/'));

var users = [];
var connections = [];

server.listen(process.env.PORT || 3000 || 3030);
console.log('Server running on port %s', server.address().port);

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
        socket.username = data;
        var user = {
            id:socket.username
        };

        //Check if user already exists
        if (userAlreadyExists(user.id)) {
            socket.emit("user already exists", "The current username already exists. Choose another one instead.");
            callback(false);
            return;
        }else {
            users.push(user);
            notifyUserConnected(user.id);
            callback(user.id);
            updateUsers();
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

    //Send a data object to all connected sockets.
    function sendMessageToAllUsers(data, timestamp){
        io.sockets.emit('new message', {type:'all', msg:data.msg, fileData:data.fileData, user:socket.username, timestamp:timestamp});
    }

    //Parse the data object's massage to distinguis between different commands.
    function parseMessage(data, socket){

        //Check if message or file is attached. If both are missing, don't send
        if(data.msg != null && data.msg != undefined && data.msg != "" || data.fileData.file != null && data.fileData.file != undefined){

            var timestamp = createTimestamp();
    
            if(data.msg.startsWith("/list")){   //Check if the massage is a list command.
                socket.emit('new message', {type:'list', msg:users, fileData:data.fileData, user:socket.username, timestamp:timestamp});
            }else if(data.msg.startsWith("/whisper")){  //CHeck if the message is a whisper command.
                //Split username from message
                var res = data.msg.split(":");
                var username = res[1].split(" ", 1);
                var msg = res[1].slice(username[0].length, res[1].length);
                //Get socket related to username
                var whisper_socket = connections.find(socket => socket.username == username);
                //Send message to self and whisper user
                if(whisper_socket){
                    whisper_socket.emit('new message',  {type:'whisper', msg:msg, fileData:data.fileData, user:socket.username, timestamp:timestamp});
                    socket.emit('new message',  {type:'whisper', msg:msg, fileData:data.fileData, user:socket.username, timestamp:timestamp});
                }
            }else{  //The message is no specific command. Send it to all users.
                sendMessageToAllUsers(data, timestamp);
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
