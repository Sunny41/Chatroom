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
    connections.push(socket);
    console.log('Connected: %s sockets connected', connections.length);

    //Disconnect
    socket.on('disconnect', function(data){
        users.splice(users.indexOf(socket.username), 1);
        updateUsers();
        connections.splice(connections.indexOf(socket), 1);
        notifyUserDisconnected(socket.username);
        console.log('Disconnected: %s sockets connected', connections.length);
    });

    //Send message
    socket.on('send message', function(data){
        parseMessage(data, socket);
    });

    //New User
    socket.on('new user', function(data, callback){
        if(users.includes(data)){
            socket.emit("user already exists", "The current username already exists. Choose another one instead.");
            callback(false);
            return;
        }

        socket.username = data;
        users.push(socket.username);
        updateUsers();
        notifyUserConnected(socket.username);
        callback(true);
    });

    //File upload
    socket.on('upload file', function(data){
        //Send the file to all sockets
        io.sockets.emit('send file', 
            {
              username: socket.username,
              file: data.file,
              fileName: data.fileName,
              type: data.type,
              size: data.size
            }    
        );
    });

    function updateUsers(){
        io.sockets.emit('get users', users);
    }

    function notifyUserConnected(username){
        io.sockets.emit('user connected', "User: " + username + " entered the room.");
    }

    function notifyUserDisconnected(username){
        io.sockets.emit('user disconnected', "User: " + username + " left the room.");
    }

    function sendMessageToAllUsers(data, timestamp){
        io.sockets.emit('new message', {msg:data, user:socket.username, timestamp:timestamp});
    }

    function parseMessage(data, socket){
        if(data != ""){
            var min = new Date().getMinutes();
            var minutes;
            if(min < 10){
                minutes = "0" + min;
            }else {
                minutes = min;
            }
            var timestamp = new Date().getHours() + ":" + minutes;

            if(data.startsWith("/list")){
                socket.emit('new message list', {users:users});
            }else if(data.startsWith("/whisper")){
                var username = data.username;
                var whisper_socket = connections.find(socket => socket.username === username);
                if(whisper_socket){
                    whisper_socket.emit('new message whisper', {msg:data, user:socket.username, timestamp:timestamp});
                    socket.emit('new message whisper', {msg:data, user:socket.username, timestamp:timestamp});
                }
            }else{
                sendMessageToAllUsers(data, timestamp);
            }
        }
    }
});
