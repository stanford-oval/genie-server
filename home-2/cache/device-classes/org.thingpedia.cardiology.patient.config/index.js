"use strict";

const Tp = require('thingpedia');

let options = {
  dataContentType: "application/json"
};

module.exports = class Cardiology_Patient extends Tp.BaseDevice {
  async do_configure_patient({ email, key }) {
    await this.engine.devices.loadOneDevice({
      kind: 'org.thingpedia.cardiology.patient',
      email, key
    }, true);
  }

};
