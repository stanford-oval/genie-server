"use strict";

const Tp = require('thingpedia');
const TT = require('thingtalk');
const uuid = require('uuid');
const crypto = require('crypto');

let options = {
  dataContentType: "application/json"
};

module.exports = class Cardiology_Doctor extends Tp.BaseDevice {
  constructor(engine, state) {
    super(engine, state);

    this.name = "Cardiology_Doctor Account for " + this.state.username;
    this.description = "This is your Cardiology Doctor Account. You can use it"
      + " to automatically remind patients to measure their blood pressure.";

    /* Stores the doctor's credentials in our database */
    let data = JSON.stringify({
      username: this.state.username,
      password: this.state.password
    });

    Tp.Helpers.Http.post("https://almond-cardiology.herokuapp.com/signup", data, options)
    .catch(err => {
      console.error(err);
    });
  }

  _findPrimaryIdentity(identities) {
      var other = null;
      var email = null;
      var phone = null;
      for (var i = 0; i < identities.length; i++) {
          var id = identities[i];
          if (id.startsWith('email:')) {
              if (email === null)
                  email = id;
          } else if (id.startsWith('phone:')) {
              if (phone === null)
                  phone = id;
          } else {
              if (other === null)
                  other = id;
          }
      }
      if (phone !== null)
          return phone;
      if (email !== null)
          return email;
      if (other !== null)
          return other;
      return null;
  }

  /*
   * Add a patient
   */
  async do_add_patient({ email }) {
    const key = crypto.randomBytes(16).toString("hex");

    await Tp.Helpers.Http.post("https://almond-cardiology.herokuapp.com/signup", JSON.stringify({
      username: email.value,
      password: key
    }), { dataContentType: 'application/json' });

    const identities = this.engine.messaging.getIdentities();
    const identity = this._findPrimaryIdentity(identities);

    const principal = await this.engine.messaging.getAccountForIdentity("email:" + email);
    if (!principal)
      throw new Error("This patient does not have a Matrix account");

    const code = `now => @org.thingpedia.cardiology.patient.config.configure_patient(
      email="${email}", key="${key}"
    );`
    const program = TT.Grammar.parse(code);

    const uniqueId = 'uuid-' + uuid.v4();
    await this.engine.remote.installProgramRemote(principal, identity, uniqueId, program);
  }

  /*
   * Returns a patient's blood pressure readings.
   */
  get_readings({ }) {
    let path = '/retrieve?doctor_username=' + this.state.username + '&doctor_password=' + this.state.password;

    return Tp.Helpers.Http.get("https://almond-cardiology.herokuapp.com" + path).then((result) => {
      const readings = JSON.parse(result.toString());
      for (let r of readings)
          r.time = new Date(r.time);
      return readings;
    });
  }
};
