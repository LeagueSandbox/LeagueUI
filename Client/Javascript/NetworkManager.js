/**
 * Created by Matt on 12/12/2016.
 */
function NetworkManager(appLogic) {
    this.appLogic = appLogic;
    this.onlinePlayers = [];
    this.selfID = -1;
    this.selfLobbyID = -1;

    this.ws = null;
}

NetworkManager.prototype.connectToServer = function() {
    this.ws = new WebSocket("ws://"+this.appLogic.appData.host+":"+this.appLogic.appData.port+"/");

    this.ws.onopen = CreateFunction(this, function()
    {
        // Web Socket is connected, send data using send()
        //this.ws.send("Message to send");
        this.appLogic.connectedToServer();
    });

    this.ws.onmessage = CreateFunction(this, function (evt)
    {
        var received_msg = evt.data;
         console.log("Got message: " + received_msg);
        var message = JSON.parse(received_msg);
        var messageTitle = message['message'];
        switch (messageTitle) {
            case "Chat": { //{message: "Chat", text: String};
                this.appLogic.mainPage.addToChat(message['text']);
            }break;
            case "Online List": { //{message: "Online List", players: {id:Number, name: String}}
                this.onlinePlayers = [];
                var players = message['players'];
                for (var i = 0; i < players.length; i++) {
                    var p = players[i];
                    var newPlayer = new Player();
                    newPlayer.id = p['id'];
                    newPlayer.nickname = p['name'];
                    newPlayer.selectedChampion = p['selectedChampion'];
                    this.onlinePlayers.push(newPlayer);
                }
                this.appLogic.mainPage.updateOnlineList();
            }
            break;
            case "Nickname Update": {//{message: "Nickname Update", id: player.id, name: player.nickname};
                for (var i = 0; i < this.onlinePlayers.length; i++) {
                    var p = this.onlinePlayers[i];
                    if (p.id == message['id']) {
                        p.nickname = message['name'];
                    }
                }
                this.appLogic.mainPage.updateOnlineList();
            }break;
            case "Player Online": {//{message: "Player Online", id: player.id};
                var p = new Player();
                p.id = message['id'];
                p.nickname = p.id + '';
                this.onlinePlayers.unshift(p);
                this.appLogic.mainPage.updateOnlineList();
            }break;
            case "Player Offline": {//{message: "Player Offline", id: player.id};
                for (var i = 0; i < this.onlinePlayers.length; i++) {
                    var p = this.onlinePlayers[i];
                    if (p.id == message['id']) {
                        this.onlinePlayers.splice(i, 1);
                        break;
                    }
                }
                this.appLogic.mainPage.updateOnlineList();
            }break;
            // {message: "Selected Champion Update", id: player.id, selectedChampion: player.selectedChampion};
            case "Selected Champion Update" : {
                for (var i = 0; i < this.onlinePlayers.length; i++) {
                    var p = this.onlinePlayers[i];
                    if (p.id == message['id']) {
                        p.selectedChampion = message['selectedChampion'];
                    }
                }
                this.appLogic.mainPage.updateOnlineList();
                this.appLogic.mainPage.lobbyPage.updateLobbyPlayer(message['id']);
            }break;
            //{message: "Self Lobby", lobbyID: player.inLobby}
            case "Self Lobby": {
                this.selfLobbyID = message['lobbyID'];
                this.appLogic.mainPage.lobbyPage.updateSelfDisplay();
            }break;
            //{message: "Lobby List", lobbies: [{id: lobby.id, name: lobby.name, blueSide: [id], redSide: [id]]}
            case "Lobby List" : {
                this.appLogic.mainPage.lobbyPage.updateLobbyList(message['lobbies']);
            }break;
            //{message: "Lobby Created", id: lobby.id, name: lobby.name}
            case "Lobby Created" : {
                this.appLogic.mainPage.lobbyPage.addLobby(message['id'], message['name']);
            }break;
            //{message: "Lobby Deleted", id: lobby.id}
            case "Lobby Deleted" : {
                this.appLogic.mainPage.lobbyPage.removeLobby(message['id']);
            }break;
            //{message: "Lobby Updated", id: lobby.id, name: lobby.name, blueSide: [id], redSide: [id]}
            case "Lobby Updated" : {
                this.appLogic.mainPage.lobbyPage.updateLobby(message['id'], message['name'], message['blueSide'], message['redSide'], message['gameServerRepository']);
            }break;
            //{message: "Start Game", port: port, playerNum: playerNum}
            case "Start Game" : {
                this.appLogic.launchLeagueOfLegends(message['port'], message['playerNum']);
                //this.appLogic.mainPage.setBlockOverlayOff();
            }break;
            case "Waiting For Game Start" : {
                this.appLogic.mainPage.setBlockOverlayOn();
            }break;
            //{message: "Repository List", repositories: this.serverLogic.gameServers};
            case "Repository List" : {
                this.appLogic.gameServerRepositories = message['repositories'];
            }break;
            case "Server Starting Log" : {
                this.appLogic.mainPage.addServerLog(message['text']);
            }break;
        }
    });

    this.ws.onclose = CreateFunction(this, function()
    {
        // websocket is closed.
        this.appLogic.mainPage.getDiv().remove();
        this.appLogic.showLoginPage();
        this.appLogic.mainPage.setBlockOverlayOff();
        this.onlinePlayers = [];
        this.selfID = -1;
        this.selfLobbyID = -1;
    });
};

NetworkManager.prototype.sendLeaveLobby = function () {
    this.send({ message: "Leave Lobby"});
};

NetworkManager.prototype.sendSwitchLobbyRepository = function(lobbyID, repositoryID) {
    this.send({message: "Set Lobby Repository", lobbyID: lobbyID, repositoryID: repositoryID});
};

NetworkManager.prototype.sendSwitchPlayerSide = function(playerID, lobbyID) {
    this.send({message: "Switch Player Side", lobbyID: lobbyID, playerID: playerID});
};

NetworkManager.prototype.sendStartGame = function(lobbyID) {
    this.send({message: "Start Game", lobbyID: lobbyID});
};

NetworkManager.prototype.sendChampionSelectChange = function(champ) {
    this.send({message: "Champion Select", champion: champ});
};

NetworkManager.prototype.sendSkinSelectChange = function(skinID) {
    this.send({message: "Skin Select", skinID: skinID});
};

NetworkManager.prototype.sendCreateLobby = function(name) {
    this.send({message: "Create Lobby", name: name});
};

NetworkManager.prototype.sendEnterLobby = function(id) {
    this.send({message: "Enter Lobby", id: id});
};

NetworkManager.prototype.sendNickname = function() {
    this.send({message: "Nickname", name: this.appLogic.appData.nickname});
};

NetworkManager.prototype.sendChat = function(chat) {
    this.send({message: "Chat", text: chat});
};

NetworkManager.prototype.send = function(object) {
    this.ws.send(JSON.stringify(object));
};

NetworkManager.prototype.getPlayerByID = function(id) {
    for (var i = 0; i < this.onlinePlayers.length; i++) {
        var p = this.onlinePlayers[i];
        if (p.id == id) return p;
    }
    return null;
};

function Player() {
    this.id = -1;
    this.nickname = "";
    this.selectedChampion = "Ezreal";
}
