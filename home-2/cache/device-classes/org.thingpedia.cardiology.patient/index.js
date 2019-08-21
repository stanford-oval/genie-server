"use strict";

const Tp = require('thingpedia');
const TT = require('thingtalk');

let options = {
  dataContentType: "application/json"
};

module.exports = class Cardiology_Patient extends Tp.BaseDevice {
  constructor(engine, state) {
    super(engine, state);

    this.name = "Cardiology Patient Account for " + this.state.email;
    this.description = "This is your Cardiology Patient Account. You can use it"
      + " to upload your blood pressure recordings for your doctor.";
  }

  /*
   * Uploads the patient's blood pressure measurements to the database
   */
  async do_record({ systolic, diastolic }, env) {
    if (!systolic)
        systolic = await env.askQuestion(TT.Type.Number, "What is your systolic blood pressure measurement? (The top number)");
    if (!diastolic)
        diastolic = await env.askQuestion(TT.Type.Number, "What is your diastolic blood pressure measurement? (The bottom number)");
    await env.say("Thank you!");

    let data = JSON.stringify({
      username: this.state.email,
      password: this.state.key,
      systolic: systolic,
      diastolic: diastolic
    });

    return Tp.Helpers.Http.post("https://almond-cardiology.herokuapp.com/upload", data, options);
  }
};
