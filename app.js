var express=require('express');
var app=express();
var fs =require('fs');
var net=require('net');
var dgram=require('dgram');
var http=require('http').createServer(app);
var io=require('socket.io').listen(http);
var os=require('os');
//给EventEmitter设置最大监听
var EventEmitter = require('events').EventEmitter;
var ee = new EventEmitter();
var nodeServer = dgram.createSocket('udp4');
var clientSocket = dgram.createSocket('udp4');
var InfoSocket = dgram.createSocket('udp4');
var dataNum = 0;
var offset=4;
var sbuf = new Buffer(4);
var haha=0;
//设置新IP和端口号
var newIPaddr=0;
var newDataPort=0;
var newCmdPort=0;
var newInfoPort=0;
// 存储客户端的WebSocket连接实例
var aSocket = null;
ee.setMaxListeners(10);
app.use(express.static('public'));
app.get('/',function(req,res){
  res.sendfile(__dirname+'/index.html');
});
//node服务器监听端口（省略127.0.0.1）
var server = http.listen(8888,function () {

  var host = server.address().address
  var port = server.address().port

  console.log("welcome to http://%s:%s", host, port)

});

//同客户端建立连接
io.sockets.on('connection', function (socketIO) {
  aSocket=socketIO;
  // 测试用，连接成功
  socketIO.emit("test","your websocket has connected");
  //socketIO接收fromwebClient的消息
  socketIO.on('fromWebClient', function (webClientData) {
    var cmdControl=new Buffer('DEVICECMD,CMD='+webClientData);
    console.log(cmdControl,newCmdPort,newIPaddr);
    //sendIfError(nodeServer,cmdControl,0,newCmdPort,newIPaddr);
    nodeServer.send(cmdControl,0,cmdControl.length,newCmdPort,newIPaddr);
    });
  //socketIO接收fromCmd的消息
  socketIO.on('fromCmd',function(CmdData){
    if(newIPaddr!=CmdData.IPaddr){
      newIPaddr=CmdData.IPaddr;
    }else{
      console.log('newIPaddr is same');
    }
    if(newCmdPort!=parseFloat(CmdData.CmdPort)){
      newCmdPort=parseFloat(CmdData.CmdPort);
    }else {
      console.log('newCmdPort is same');
    }
    if(newDataPort!=parseFloat(CmdData.DataPort)){
      newDataPort=parseFloat(CmdData.DataPort);
      //nodeServer绑定端口DataPort
      bindPort(nodeServer,newDataPort);
    }else {
      console.log('newDataPort is same');
    }
    if(newInfoPort!=parseFloat(CmdData.InfoPort)){
      newInfoPort=parseFloat(CmdData.InfoPort);
      //InfoSocket绑定端口InfoPort
      bindPort(InfoSocket,newInfoPort);
    }else{
      console.log('newInfoPort is same');
    }
  });
  //socketIO接收fromTime的消息
  socketIO.on('fromTime',function(tData){
    var newTime=parseFloat(tData.timeData);
    console.log(newTime);
    receiveData(newTime);
  })
});
// 从C服务器接收数据
nodeServer.on('message', function (msg) {
  dataNum=msg.readInt32LE(0);
  console.log(dataNum);
  console.log(msg.length);
  var useData=byteArrayUntil.getUseJson(msg,offset);
  console.log(useData);
  if(aSocket!=null){
    aSocket.emit('pushToWebClient',useData);
    aSocket.on('disconnect', function () {
      console.log('DISCONNECTED FROM CLIENT');
    });

  }

});
// 为客户端添加“close”事件处理函数
nodeServer.on('close', function() {
  console.log('Connection closed');
});
//绑定端口处理错误函数
function bindPort(socket,port){
  socket.bind(port);
  socket.on('error',function(err){
    console.error(err);
    socket.close();
  })
}
//发送消息处理错误函数
function sendIfError(socket,data,offset,port,IPaddr){
  socket.send(data,offset,data.length,port,IPaddr);
  socket.on('error',function(err){
    console.error(err);
  });
}
//接收C服务器数据的频率(单位：ms)
function receiveData(data){
  var cmdData=new Buffer("RTDATA");
  function sendTime(){
    nodeServer.send(cmdData,0,cmdData.length,newCmdPort,newIPaddr);
    nodeServer.on('error',function(err){
      console.error(err);
    })
  }
  setInterval(sendTime,data);
}
//构造一个遍历函数,分别返回array或者json
var byteArrayUntil=new function(){
  this.getUseData=function(msg,offset){
    var arr=[];
    for(var i=0;i<=dataNum;i++){
      arr.push(msg.readFloatLE(8+i*offset));
    }
    return arr;
  }
  this.getUseJson=function(msg,offset){
    var arr1=[];
    var arr2=[];
    for(var i=0;i<dataNum;i++){
      arr1.push(msg.readFloatLE(8+i*offset));
      arr2.push(msg.readFloatLE(8+dataNum*offset+i*offset).toFixed(2));
    }
    return {'hz':arr1,
            'dbm':arr2};
  }

}();