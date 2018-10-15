//index.js

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
        if (users.includes(data)) {
            socket.emit("user already exists", "The current username already exists. Choose another one instead.");
            callback(false);
            return;
        }else {
            socket.username = data;
            users.push(data);
            updateUsers();
            notifyUserConnected(data);
            callback(data);
        }
    });
    //Add connection to connections array
    function connect(socket){
        connections.push(socket);
        console.log('Connected: %s sockets connected', connections.length);
    }
    //Remove user from users array and remove connection from connections array. Update users.
    function disconnect(socket) {
        users.splice(users.indexOf(socket.username), 1);
        updateUsers();
        connections.splice(connections.indexOf(socket), 1);
        notifyUserDisconnected(socket.username);
        console.log('Disconnected: %s sockets connected', connections.length);
    }

    //Update users.
    function updateUsers(){
        console.log("Users: " + users);
        io.sockets.emit('get users', users);
    }

    //Notify that new user connected.
    function notifyUserConnected(username){
        var msg = "User " + username + " entered the room.";
        var timestamp = createTimestamp();
        io.sockets.emit('new message',  {type:'connected', msg:msg, fileData:null, user:socket.username, timestamp:timestamp});
    }

    //Notify that user disconnected.
    function notifyUserDisconnected(username){
        var msg = "User: " + username + " left the room.";
        var timestamp = createTimestamp();
        io.sockets.emit('new message',  {type:'disconnected', msg:msg, fileData:null, user:socket.username, timestamp:timestamp});
    }

    //Send a data object to all connected sockets.
    function sendMessageToAllUsers(data, timestamp){
        io.sockets.emit('new message', {type:'all', msg:data.msg, fileData:data.fileData, user:socket.username, timestamp:timestamp});
    }

    //Parse the data object's massage to distinguis between different commands.
    function parseMessage(data, socket){
        var timestamp = createTimestamp();

        //Set a message value if there is no massage to avoid errors.
        if(data.msg == null || data.msg == undefined){
            data.msg = "";
        }

        if(data.msg.startsWith("/list")){   //Check if the massage is a list command.
            socket.emit('new message', {type:'list', msg:users, fileData:data.fileData, user:socket.username, timestamp:timestamp});
        }else if(data.msg.startsWith("/whisper")){  //CHeck if the message is a whisper command.
            var res = data.msg.split(":");
            var username = res[1].split(" ", 1);
            var msg = res[1].slice(username[0].length, res[1].length);
            var whisper_socket = connections.find(socket => socket.username == username);
            if(whisper_socket){
                whisper_socket.emit('new message',  {type:'whisper', msg:msg, fileData:data.fileData, user:socket.username, timestamp:timestamp});
                socket.emit('new message',  {type:'whisper', msg:msg, fileData:data.fileData, user:socket.username, timestamp:timestamp});
            }
        }else{  //The message is no specific command. Send it to all users.
            sendMessageToAllUsers(data, timestamp);
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
});
