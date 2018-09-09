/**
 * Created by Matt on 12/13/2016.
 */
var Lobby = require('./Lobby');
var Utility = require('./Utility/Utility');
var CreateFunction = Utility.CreateFunction;

function LobbyManager(serverLogic) {
    this.serverLogic = serverLogic;
    this.currentLobbyID = 0;
    this.lobbies = [];
}
LobbyManager.prototype.createLobby = function (name) {
    var lobby = new Lobby();
    lobby.id = this.currentLobbyID;
    this.currentLobbyID++;
    lobby.name = name;
    if (name == "") lobby.name = lobby.id + '';
    this.lobbies.unshift(lobby);

    this.serverLogic.networkManager.sendToAll(this.serverLogic.networkManager.getLobbyCreateMessage(lobby));

    return lobby.id;
};
LobbyManager.prototype.switchPlayerSide = function (playerID, lobbyID) {
    var lobby = this.getLobbyForID(lobbyID);
    if (lobby == null) return;

    var player = null;
    var playerOnBlue = false;
    var playerOnRed = false;
    for (var i = 0; i < lobby.blueSidePlayers.length; i++) {
        if (lobby.blueSidePlayers[i].id == playerID) {
            player = lobby.blueSidePlayers[i];
            playerOnBlue = true;
        }
    }
    for (var i = 0; i < lobby.redSidePlayers.length; i++) {
        if (lobby.redSidePlayers[i].id == playerID) {
            player = lobby.redSidePlayers[i];
            playerOnRed = true;
        }
    }
    if (player == null) return;
    if (playerOnBlue) {
        lobby.blueSidePlayers.splice(lobby.blueSidePlayers.indexOf(player), 1);
        lobby.redSidePlayers.push(player);
    }
    if (playerOnRed) {
        lobby.redSidePlayers.splice(lobby.redSidePlayers.indexOf(player), 1);
        lobby.blueSidePlayers.push(player);
    }
    this.serverLogic.networkManager.sendToAll(this.serverLogic.networkManager.getLobbyUpdateMessage(lobby));
};
LobbyManager.prototype.setLobbyRepository = function(lobbyID, repositoryID) {
    var lobby = this.getLobbyForID(lobbyID);
    if (lobby == null) return;

    lobby.gameServerRepository = repositoryID;

    this.serverLogic.networkManager.sendToAll(this.serverLogic.networkManager.getLobbyUpdateMessage(lobby));
};
LobbyManager.prototype.enterLobby = function (player, lobbyID) {
    this.removePlayerFromLobby(player);

    var lobby = this.getLobbyForID(lobbyID);
    if (lobby == null) return;
    lobby.blueSidePlayers.push(player);

    player.inLobby = lobbyID;

    this.serverLogic.networkManager.sendToAll(this.serverLogic.networkManager.getLobbyUpdateMessage(lobby));

    this.serverLogic.networkManager.sendToPlayer(player, this.serverLogic.networkManager.getSelfInLobbyMessage(player));
};
LobbyManager.prototype.removePlayerFromLobby = function (player) {
    if (player.inLobby == -1) return;
    var lobby = this.getLobbyForID(player.inLobby);
    if (lobby == null) return;
    lobby.removePlayer(player);

    this.serverLogic.networkManager.sendToAll(this.serverLogic.networkManager.getLobbyUpdateMessage(lobby));

    this.serverLogic.networkManager.sendToPlayer(player, this.serverLogic.networkManager.getSelfInLobbyMessage(player));

    if (lobby.getNumberOfPlayers() == 0) {
        this.deleteLobby(lobby);
    }
};

LobbyManager.prototype.startGame = function (lobbyID) {
    var lobby = this.getLobbyForID(lobbyID);
    if (lobby == null) return;

    var gs = this.serverLogic.gameServers[lobby.gameServerRepository];
    var repository = gs['repository'];
    var branch = gs['branch'];
    var json = lobby.buildGameJSON(repository, branch);

    const getPort = require('get-port');

    getPort().then(CreateFunction(this, function (port) {

        var players = [];

        for (var i = 0; i < lobby.blueSidePlayers.length; i++) {
            var player = lobby.blueSidePlayers[i];
            players.push(player);
        }
        for (var i = 0; i < lobby.redSidePlayers.length; i++) {
            var player = lobby.redSidePlayers[i];
            players.push(player);
        }
        for (var i = 0; i < players.length; i++) {
            var player = players[i];
            this.serverLogic.networkManager.sendToPlayer(player, this.serverLogic.networkManager.getWaitingForGameStart());
        }

        this.deleteLobby(lobby);


        this.serverLogic.startGameServer(repository, branch, json, port, CreateFunction(this, function(message){
            //Message callback
            for (var i = 0; i < players.length; i++) {
                var player = players[i];
                this.serverLogic.networkManager.addToServerMessageLog(player, message);
            }

        }), CreateFunction(this, function () {
            //Start game callback
            for (var i = 0; i < players.length; i++) {
                var player = players[i];
                this.serverLogic.networkManager.sendToPlayer(player, this.serverLogic.networkManager.getStartGame(port, i + 1));
            }

        }));
    }));

};

LobbyManager.prototype.deleteLobby = function (lobby) {
    //Remove all players from lobby
    while (lobby.blueSidePlayers.length > 0) {
        var p = lobby.blueSidePlayers[0];
        lobby.removePlayer(p);
        this.serverLogic.networkManager.sendToPlayer(p, this.serverLogic.networkManager.getSelfInLobbyMessage(p));
    }
    while (lobby.redSidePlayers.length > 0) {
        var p = lobby.redSidePlayers[0];
        lobby.removePlayer(p);
        this.serverLogic.networkManager.sendToPlayer(p, this.serverLogic.networkManager.getSelfInLobbyMessage(p));
    }
    this.lobbies.splice(this.lobbies.indexOf(lobby), 1);

    this.serverLogic.networkManager.sendToAll(this.serverLogic.networkManager.getLobbyDeleteMessage(lobby));
};

LobbyManager.prototype.startLobby = function (id) {
    var lobby = this.getLobbyForID(id);
    if (lobby == null) return;

    this.deleteLobby(lobby);
}

LobbyManager.prototype.getLobbyForID = function (id) {
    for (var i = 0; i < this.lobbies.length; i++) {
        var lobby = this.lobbies[i];
        if (lobby.id == id) return lobby;
    }
    return null;
};

module.exports = LobbyManager;