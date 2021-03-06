const logger = require('../utils/logger').logger('mongo-survey');
const mongoose = require('mongoose');
const globalId = require('../utils/global-id');
const Statistic = require('./statistic')
const Schema = mongoose.Schema;

const AnswerSchema = new Schema({
    value : String,
    imageUrl : String,
    correct : Boolean,
    next    : Number,
    end     : Number
});

const SubjectSchema = new Schema({
    id: { type : Number, required: true },
    type : String,   // radio | checkbox | text | date | position | phone
    nlu  : Boolean,
    question : String,
    imageUrl : String,
    answers  : [AnswerSchema]
});

const ConclusionSchema = new Schema({
    scoreRange : {
        min : Number,
        max : Number
    },
    id : Number,
    text  : String,
    imageUrl : String
});

const surveySchema = new Schema({
    id      : { type: String, unique: true, required: true},
    userId  : { type: String, required: true},
    type    : { type: String, required: true }, // inquiry | poll | exam | branch-quiz
    title   : { type: String, required: true},
    intro   : { type: String},
    avatarUrl : { type: String },
    subjects: [SubjectSchema],
    conclusions : [ConclusionSchema]
}, { timestamps: { createdAt: 'created_at' } });

mongoose.model('Surveys', surveySchema);

const AnswerResultSchema = new Schema({
    id    : {type : Number, required: true},
    result: [AnswerSchema]
});

const ResponderSchema = new Schema({
    userId    : {type : String, required: true},
    nickName  : {type : String},
    avatarUrl : {type : String}
});

mongoose.model('SurveyResults', new Schema({
    id      : { type: String, unique: true, required: true},
    surveyId: { type: String, required: true},
    responder  : { type: ResponderSchema, required: true},
    answers : [AnswerResultSchema],
    score   : Number,
    conclusion : Number,
    survey  : Object
}, { timestamps: { createdAt: 'created_at' } }));

const Survey = mongoose.model('Surveys');
const SurveyResult = mongoose.model('SurveyResults');

const model = {};

model.getSurveyById = async (id) => {
    logger.debug(`Looking up survey by id ${id}`);
    return await Survey.findOne({id : id}).exec();
};

model.getSurveyByUser = async (userId) => {
    logger.debug(`Looking up survey by user id ${userId}`);
    return await Survey.find({userId : userId}).exec();
};

model.addSurvey = async (userId, survey) => {
    logger.debug(`add new survey for user ${userId}`);
    const surveyId = globalId();
    const newSurvey = new Survey({
        id : surveyId,
        userId : userId,
        type : survey.type,
        title: survey.title,
        intro: survey.intro,
        avatarUrl : survey.avatarUrl,
        subjects: survey.subjects,
        conclusions: survey.conclusions
    });
    await newSurvey.save();
    await Statistic.addSurveyStatistic(newSurvey);
    logger.debug(`Add new survey ${surveyId} for user ${userId} successful!`);
    
    return surveyId;
};

model.updateSurvey = async (userId, survey) => {
    if (!survey.id) {
        return model.addSurvey(userId, survey);
    }

    logger.debug(`update survey ${survey.id} for user ${userId}`);
    const oriSurvey = await Survey.findOne({id : survey.id}).exec();
    if (!oriSurvey) {
        throw Error(`update unexisted survey ${survey.id} of user ${userId}`);
    }
    oriSurvey.set(survey);
    await oriSurvey.save();
    await Statistic.deleteSurveyStatistic(survey.id);
    await Statistic.addSurveyStatistic(oriSurvey);
    logger.debug(`update survey ${survey.id} for user ${userId} successful!`); 
    return survey.id;
};

model.deleteSurvey = async (id) => {
    await Survey.deleteOne({id : id});
    await Statistic.deleteSurveyStatistic(id);
    logger.debug(`delete survey ${id} successful!`);
}

model.getSurveyResultById = async (id) => {
    logger.debug(`get survey result ${id}`);
    return await SurveyResult.findOne({id : id}).exec();    
}

model.getSurveyResultsByUser = async (userId) => {
    logger.debug(`get survey result by user ${userId}`);
    return await SurveyResult.find({'responder.userId' : userId}).exec();
}

model.getSurveyResults = async (surveyId) => {
    logger.debug(`find results of survey ${surveyId}`);
    return await SurveyResult.find({surveyId : surveyId}).exec();
}

model.addSurveyResult = async (userId, surveyResult) => {
    logger.debug(`add new survey result of user ${userId}`);
    const survey = await model.getSurveyById(surveyResult.surveyId);
    const id = globalId();
    const newSurveyResult = new SurveyResult({
        id : id,
        surveyId : surveyResult.surveyId,
        responder : surveyResult.responder,
        answers : surveyResult.answers,
        score: surveyResult.score,
        survey: survey

    });
    await newSurveyResult.save();
    await Statistic.addSurveyResult(surveyResult);
    logger.debug(`Add new survey result ${id} of survey ${surveyResult.surveyId} successful!`); 
    return id;       
}

model.updateSurveyResult = async (userId, surveyResult) => {
    if (!surveyResult.id) {
        return model.addSurveyResult(userId, surveyResult);
    }

    logger.debug(`update survey result ${surveyResult.id} of user ${userId}`);
    const oriSurveyResult = await SurveyResult.findOne({id : surveyResult.id}).exec();
    if (!oriSurveyResult) {
        throw Error(`update unexisted survey result ${oriSurveyResult.id} of user ${userId}`);
    }
    oriSurveyResult.set({
        id : surveyResult.id,
        surveyId : surveyResult.surveyId,   
        responder : surveyResult.responder,
        answers : surveyResult.answers,
        score: surveyResult.score,
        survey: oriSurveyResult.survey   
    });
    await oriSurveyResult.save();
    logger.debug(`update survey result ${surveyResult.id} of user ${userId} successful!`); 
    return surveyResult.id;
};

model.deleteSurveyResult = async (id) => {
    await SurveyResult.deleteOne({id : id});
    logger.debug(`delete survey result ${id} successful!`); 
}

model.getStatisticByUser = async (userId) => {
    logger.debug(`get statistic by user ${userId}`);
    const result = {createdCount : 0, receivedCount : 0};
    const createdSurveys = await model.getSurveyByUser(userId);
    const receivedSurveys = await model.getSurveyResultsByUser(userId);
    if (createdSurveys) {
        result.createdCount = createdSurveys.length;
    }
    if (receivedSurveys) {
        result.receivedCount = receivedSurveys.length;
    }
    return result;
}

module.exports = model;
