Players = new Meteor.Collection('players');
Marbles = new Meteor.Collection('marbles');
States = new Meteor.Collection('states');

if (Meteor.isClient) {
  var BOARD_SIZE = 800;
  var HOLE_SPACE = BOARD_SIZE * 0.045;
  var HOLE_SIZE = BOARD_SIZE * 0.03;
  var DRAW_IDS = false; // for debugging
  var COLORS = ['#444444', '#009922', '#cc3333', '#eeeeee', '#3333cc', '#eeee22'];
  var COLOR_NAMES = ['black', 'green', 'red', 'white', 'blue', 'yellow']
  
  function getCurrentState() {
    return States.findOne({'key': 'state'});
  }
  
  function getCurrentPlayer() {
    var state = getCurrentState();
    return state && state.player;
  }
  
  function getCurrentStateType() {
    var state = getCurrentState();
    return state && state.kind;
  }

  function computePositions() {
    var result = {};
    for (var group = 0; group < 6; group++) {
      var angle = group * -60;
      var centerFirstLine = holeCenter(90 + angle, 8.5);
      var x, y, offsetX, offsetY, id;
      
      for (i = 0; i < 22; i++) {
        if (i == 0 || i == 5 || i == 10 || i == 14 || i == 18) {
          if (i == 5) {
            angle -= 90;
          } else if (i == 10) {
            angle += 120;
          } else if (i == 14) {
            angle = group * -60 - 90;
            x = centerFirstLine[0];
            y = centerFirstLine[1];
          } else if (i == 18) {
            angle = group * -60 - 60;
            var c = holeCenter(180 + angle, 11);
            x = c[0];
            y = c[1];
          }
          offsetX = Math.cos(radians(angle)) * HOLE_SPACE;
          offsetY = - Math.sin(radians(angle)) * HOLE_SPACE;
        }
        
        if (i < 14) {
          // normal space
          id = 'N' + (group * 14 + i);
        } else if (i < 18) {
          // home
          id = 'H' + group + (i - 14);
        } else {
          // base
          id = 'B' + group + (i - 18);
        }
        
        if (i == 0) {
          x = centerFirstLine[0] - offsetX * 2;
          y = centerFirstLine[1] - offsetY * 2;
        } else {
          x += offsetX;
          y += offsetY;
        }
        result[id] = [x, y];
      }
    }
    result['C'] = holeCenter(0, 0);
    return result;
  }
  var POSITIONS = computePositions();

  function radians(angle) {
    return angle * Math.PI / 180;
  }
  
  function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function holeCenter(angle, radius) {
    return [
      Math.cos(radians(angle)) * radius * HOLE_SPACE + BOARD_SIZE / 2,
      BOARD_SIZE / 2 - Math.sin(radians(angle)) * radius * HOLE_SPACE
    ];
  }
  
  function drawCircle(ctx, pos, radius, color, width, opt_alpha, opt_fill) {
    ctx.save();
    ctx.globalAlpha = opt_alpha ? opt_alpha : 1;
    ctx.beginPath();
    ctx.arc(pos[0], pos[1], radius, 0, 2*Math.PI);

    if (width) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.stroke();    
    }
    if (opt_fill) {
      ctx.fillStyle = opt_fill;
      ctx.fill();
    }
    ctx.restore();
  }
  
  function drawBoard() {
    var marbles = getMarbleMap();
  
    var i;
    var canvas = document.getElementById('board');
    canvas.width = BOARD_SIZE;
    canvas.height = BOARD_SIZE;
    var ctx = canvas.getContext('2d');
    for (var group = 0; group < 6; group++) {
      drawCircle(ctx, POSITIONS['N' + (group * 14 + 4)], HOLE_SIZE / 2 + 2, COLORS[group], 3);
      
      var homeStart = POSITIONS['H' + group + '0'];
      var homeEnd = POSITIONS['H' + group + '3'];
      ctx.lineWidth = HOLE_SPACE;
      ctx.lineCap = 'round';
      ctx.strokeStyle = COLORS[group];
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(homeStart[0], homeStart[1]);
      ctx.lineTo(homeEnd[0], homeEnd[1]);
      ctx.stroke();
    }
    for (var id in POSITIONS) {
      var pos = POSITIONS[id];
      var isBase = id[0] == 'B';
      drawCircle(ctx, pos, HOLE_SIZE / 2 + (isBase ? 1 : 0), isBase ? COLORS[parseInt(id[1])] : '#000000', isBase ? 2 : 1, isBase ? 0.6 : 1);
      if (id in marbles) {
        var lightOffset = HOLE_SIZE / 9;
        drawCircle(ctx, pos, HOLE_SIZE / 2, null, null, 1, COLORS[marbles[id]]);
        var shadow = ctx.createRadialGradient(
            pos[0] - lightOffset, pos[1] - lightOffset, 0,
            pos[0] - lightOffset, pos[1] - lightOffset, HOLE_SIZE / 2);
        shadow.addColorStop(0, 'rgba(0, 0, 0, 0)');
        shadow.addColorStop(0.4, 'rgba(0, 0, 0, 0.05)')
        shadow.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
        drawCircle(ctx, pos, HOLE_SIZE / 2, null, null, 1, shadow);
        var highlight = ctx.createRadialGradient(
            pos[0] - lightOffset, pos[1] - lightOffset, 0,
            pos[0] - lightOffset, pos[1] - lightOffset, HOLE_SIZE / 7)
        highlight.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
        highlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
        drawCircle(ctx, pos, HOLE_SIZE / 2, null, null, 1, highlight);
      }
      if (DRAW_IDS) {
        ctx.font = '10px Helvetica';
        var m = ctx.measureText(id);
        ctx.fillText(id, pos[0] - m.width / 2, pos[1] + 5);
      }
    }
  }
  
  function getMarbleMap() {
    var map = {};
    Marbles.find({}).forEach(function(item) {
      map[item.position] = item.player;
    });
    return map;
  }
  
  function getLegalMoves(marbles, player, roll) {
    var result = [];
    for (var position in marbles) {
      if (marbles[position] == player) {
        var moves = getLegalMovesForMarble(marbles, position, position, player, roll);
        for (var newPosition in moves) {
          result.push({
            'from': position,
            'to': newPosition
          });
        }
      }
    }
    return result;
  }
  
  function addAll(h1, h2) {
    for (var k in h2) {
      h1[k] = h2[k];
    }    
  }
  
  function isPoint(pos) {
    return pos[0] == 'N' && parseInt(pos.substring(1)) % 14 == 9;
  }
  
  function getLegalMovesForMarble(marbles, start, current, player, roll) {
    var result = {};
    if (start != current && marbles[current] == player) {
      return result;
    }
    if (roll == 0) {
      result[current] = player;
      return result;
    }

    if (current[0] == 'H' && current != 'H03') {
      addAll(result, getLegalMovesForMarble(marbles, start, 'H' + player +  '' + (parseInt(current[2]) + 1), player, roll - 1));
            
    } else if (current[0] == 'B') {
      if (roll == 1 || roll == 6) {
        var newPos = 'N' + (player * 14 + 4);
        if (marbles[newPos] != player) {
          result[newPos] = player;
        }
      }
    } else if (current[0] == 'N') {
      var num = parseInt(current.substring(1));
      
      if (num % 14 == 9) {
        // Point.
        if (isPoint(start) && (((player + 5) % 6) * 14 + 9) != num) {
          // We actually started on the point and this isn't our last point.
          addAll(result, getLegalMovesForMarble(marbles, start, 'N' + ((num + 14) % 84), player, roll - 1));
        }
        if (roll == 1 && (current == start || !isPoint(start))) {
          // Move to center.
          if (marbles['C'] != player) {
            result['C'] = player;
          }
        }
      }
      
      if (num == (player * 14 + 2)) {
        // Turn to home.
        addAll(result, getLegalMovesForMarble(marbles, start, 'H' + player + '0', player, roll - 1));
      } else {
        // Normal move.
        addAll(result, getLegalMovesForMarble(marbles, start, 'N' + ((num + 1) % 84), player, roll - 1));
      }      
    } else if (current[0] == 'C') {
      if (roll == 1 && current == start) {
        for (var destGroup = 0; destGroup < 6; destGroup++) {
          var newPos = 'N' + (destGroup * 14 + 9);
          if (marbles[newPos] != player) {
            result[newPos] = player;
          }
        }        
      }
    }
    return result;
  }

  Template.board.rendered = function() {
    Meteor.autosubscribe(drawBoard);
  };
  
  function getPlayers() {
    var out = [];
    for (var i = 0; i < 6; i++) {
      out.push({'open': true, 'name': COLOR_NAMES[i], 'color': i, 'hex': COLORS[i]});
    }
    Players.find({}).forEach(function(p) {
      out[p.color] = {'name': p.name, 'color': p.color, 'hex': COLORS[p.color]};
    });
    return out;    
  }

  Template.players.players = getPlayers;
  
  Template.players.events({
    'click .addPlayer': function(e) {
      e.preventDefault();
      var color = parseInt(e.target.id.split(/(\d+)/)[1]);
      var name = prompt('Enter your name:');
      if (name) {
        Players.insert({'name': name, 'color': color});
        Marbles.insert({'position': 'B' + color + '0', 'player': color});
        Marbles.insert({'position': 'B' + color + '1', 'player': color});
        Marbles.insert({'position': 'B' + color + '2', 'player': color});
        Marbles.insert({'position': 'B' + color + '3', 'player': color});
        if (!getCurrentState()) {
          States.insert({'key': 'state', 'player': color, 'kind': 'waiting'});
        }
      }
    }
  });
  
  Template.roll.rendered = function() {
    window.clearInterval(this.rollTimeout);
    if (getCurrentStateType() == 'rolling') {
      var s = this;
      this.rollTimeout = window.setInterval(function() {
        s.find('#die').className = 'value' + getRandomInt(1, 6);
      }, 75);
    } else {
      var die = this.find('#die');
      if (die) {
        die.className = 'value' + Template.roll.dieValue();
      }
    }
  };

  Template.roll.dieValue = function() {
    var item = States.findOne({'key': 'state'});
    return item ? item.die : 1;
  };
  
  Template.roll.moves = function() {
    if (getCurrentStateType() == 'rolled') {
      var value = Template.roll.dieValue();
      return getLegalMoves(getMarbleMap(), getCurrentPlayer(), value);
    } else {
      return [];
    }
  };
  
  Template.roll.playerCount = function() {
    var players = getPlayers();
    var count = 0;
    for (var i = 0; i < 6; i++) {
      if (!players[i].open) {
        count++;
      }
    }
    return count;
  };
  
  Template.roll.activePlayer = getCurrentPlayer;

  Template.roll.activePlayerName = function() {
    var players = getPlayers();
    var currentPlayer = getCurrentPlayer();
    if (currentPlayer in players) {
      return players[currentPlayer].name;      
    } else {
      console.log(currentPlayer + '/' + players.length + '?');
      return '';
    }
  }
  
  Template.roll.isWaiting = function() {
    return getCurrentStateType() == 'waiting';
  }
  
  Template.roll.isRolled = function() {
    return getCurrentStateType() == 'rolled';
  }
  
  Template.roll.events({
    'click #rollLink': function(e) {
      States.update({'key': 'state'}, {'$set': {'kind': 'rolling'}});
      window.setTimeout(function() {
        States.update({'key': 'state'}, {'$set': {'kind': 'rolled', 'die': getRandomInt(1, 6)}});
      }, 900);
    },
    'click .move': function(e) {
      e.preventDefault();
      var move = e.target.innerText.split(' - ');
      var moved = false;
      if (move.length == 2) {
        Marbles.update({'position': move[0]}, {'$set': {'position': move[1]}});
        // TODO: handle opponent marble knock off
        moved = true;
      }
      var current = getCurrentPlayer();
      if (Template.roll.dieValue() != 6 || !moved) {
        var players = getPlayers();
        current = (current + 1) % 6;
        while (players[current].open) {
          current = (current + 1) % 6;
        }
      }
      States.update({'key': 'state'}, {'$set': {'kind': 'waiting', 'player': current}});
    }
  });
  
  function reset() {
    States.remove({});
    Players.remove({});
    Marbles.remove({});
  }
}

if (Meteor.isServer) {
  Meteor.startup(function () {
    // code to run on server at startup
  });
}
