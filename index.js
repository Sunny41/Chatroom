var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);
var fs = require('fs');
var path = require('path');

app.use(express.static(__dirname + '/'));

var users = [];
var connections = [];

server.listen(process.env.PORT || 3000);
console.log('Server running');

app.get('/upload', function(req, res){
    res.sendFile(__dirname + '/upload.html');
});

io.sockets.on('connection', function(socket){
    connect(socket);

    //Disconnect
    socket.on('disconnect', function(data){
        disconnect(socket);
    });

    //Send message
    socket.on('send message', function(data){
        parseMessage(data, socket);
    });

    //New User
    socket.on('new user', function(data, callback){
        if(users.includes(socket.username)){
            socket.emit("user already exists", "The current username already exists. Choose another one instead.");
            callback(false);
            return;
        }

        socket.username = data;
        users.push(socket.username);
        updateUsers();
        notifyUserConnected(data);
        callback(data);
    });

    //File upload
    socket.on('upload file', function(data){
        //Send the file to all sockets
        var timestamp = createTimestamp();
        io.sockets.emit('send file', 
            {
              username: socket.username,
              file: data.file,
              fileName: data.fileName,
              type: data.type,
              size: data.size,
              timestamp: timestamp
            }    
        );
    });

    function connect(socket){
        connections.push(socket);
        console.log('Connected: %s sockets connected', connections.length);
    }

    function disconnect(socket) {
        users.splice(users.indexOf(socket.username), 1);
        updateUsers();
        connections.splice(connections.indexOf(socket), 1);
        notifyUserDisconnected(socket.username);
        console.log('Disconnected: %s sockets connected', connections.length);
    }

    function updateUsers(){
        console.log("Users: " + users);
        io.sockets.emit('get users', users);
    }

    function notifyUserConnected(username){
        var alert = {};
        alert.msg = "User " + username + " entered the room.";
        alert.timestamp = createTimestamp();
        io.sockets.emit('user connected', alert);
    }

    function notifyUserDisconnected(username){
        var alert = {};
        alert.msg = "User: " + username + " left the room.";
        alert.timestamp = createTimestamp();
        io.sockets.emit('user disconnected', alert);
    }

    function sendMessageToAllUsers(data, timestamp){
        io.sockets.emit('new message', {msg:data.msg, fileData:data.fileData, user:socket.username, timestamp:timestamp});
    }

    function parseMessage(data, socket){
        var timestamp = createTimestamp();

        if(data.msg == null || data.msg == undefined){
            data.msg = "";
        }

        if(data.msg.startsWith("/list")){
            socket.emit('new message list', {users:users});
        }else if(data.msg.startsWith("/whisper")){
            var res = data.msg.split(":");
            var username = res[1].split(" ", 1);
            var msg = res[1].slice(username[0].length, res[1].length);
            var whisper_socket = connections.find(socket => socket.username == username);
            if(whisper_socket){
                whisper_socket.emit('new message whisper',  {msg:msg, fileData:data.fileData, user:socket.username, timestamp:timestamp});
                socket.emit('new message whisper',  {msg:msg, fileData:data.fileData, user:socket.username, timestamp:timestamp});
            }
        }else{
            sendMessageToAllUsers(data, timestamp);
        }
    }

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
