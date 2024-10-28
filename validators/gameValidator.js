const Joi = require('joi');

const gameSchema = Joi.object({
    title: Joi.string().min(3).required(),
    rounds: Joi.number().integer().min(1).required(),
    textTime: Joi.number().integer().min(1).required(),
    voteTime: Joi.number().integer().min(1).required(),
    maxPlayers: Joi.number().integer().min(1).required(),
});

module.exports = {
    validateGame: (data) => gameSchema.validate(data),
};
