import { Mongo } from 'meteor/mongo';
 
export const Players = new Mongo.Collection('players');
export const Marbles = new Mongo.Collection('marbles');
export const States = new Mongo.Collection('states');

Meteor.methods({
  'states.update'(key, updates) {
    States.update({'key': key}, updates);
  },
  'marbles.move'(from, to) {
    Marbles.update({'position': from}, {'$set': {'position': to}});
  },
  'game.reset'() {
	  States.remove({});
	  Players.remove({});
	  Marbles.remove({});
  }
});