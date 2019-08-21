"use strict";
$(function() {
    var thingpediaUrl = document.body.dataset.thingpediaUrl;
    var url = (location.protocol === 'https' ? 'wss' : 'ws') + '://' + location.host
        + '/api/conversation';
    console.log(url);
    var ws = new WebSocket(url);

    function syncCancelButton(msg) {
        var visible = msg.ask !== null;
        if (visible)
            $('#cancel').removeClass('hidden');
        else
            $('#cancel').addClass('hidden');
    }

    var container = $('#chat');
    var currentGrid = null;

    function almondMessage(icon) {
        var msg = $('<span>').addClass('message-container from-almond');
        icon = icon || 'org.thingpedia.builtin.thingengine.builtin';
        var src = thingpediaUrl + '/api/devices/icon/' + icon;
        msg.append($('<img>').addClass('icon').attr('src', src));
        container.append(msg);
        return msg;
    }

    function textMessage(text, icon) {
        var container = almondMessage(icon);
        container.append($('<span>').addClass('message message-text')
            .text(text));
        container[0].scrollIntoView(false);
    }

    function picture(url, icon) {
        var container = almondMessage(icon);
        container.append($('<img>').addClass('message message-picture')
            .attr('src', url));
        container[0].scrollIntoView(false);
    }

    function rdl(rdl, icon) {
        var container = almondMessage(icon);
        var rdlMessage = $('<a>').addClass('message message-rdl')
            .attr('href', rdl.webCallback);
        rdlMessage.append($('<span>').addClass('message-rdl-title')
            .text(rdl.displayTitle));
        rdlMessage.append($('<span>').addClass('message-rdl-content')
            .text(rdl.displayText));
        container.append(rdlMessage);
        container[0].scrollIntoView(false);
    }

    function getGrid() {
        if (!currentGrid) {
            var wrapper = $('<div>').addClass('message-container button-grid container');
            currentGrid = $('<div>').addClass('row');
            wrapper.append(currentGrid);
            container.append(wrapper);
        }
        return currentGrid;
    }

    function choice(idx, title) {
        var holder = $('<div>').addClass('col-xs-12 col-sm-6');
        var btn = $('<a>').addClass('message message-choice btn btn-default')
            .attr('href', '#').text(title);
        btn.click(function(event) {
            handleChoice(idx, title);
            event.preventDefault();
        });
        holder.append(btn);
        getGrid().append(holder);
        holder[0].scrollIntoView(false);
    }

    function buttonMessage(title, json) {
        var holder = $('<div>').addClass('col-xs-12 col-sm-6 col-md-4');
        var btn = $('<a>').addClass('message message-button btn btn-default')
            .attr('href', '#').text(title);
        btn.click(function(event) {
            handleParsedCommand(json, title);
            event.preventDefault();
        });
        holder.append(btn);
        getGrid().append(holder);
        holder[0].scrollIntoView(false);
    }

    function linkMessage(title, url) {
        /*if (url === '/apps')
            url = '/me';
        else if (url.startsWith('/devices'))
            url = '/me' + url;*/

        var holder = $('<div>').addClass('col-xs-12 col-sm-6 col-md-4');
        var btn = $('<a>').addClass('message message-button btn btn-default')
            .attr('href', url).text(title);
        holder.append(btn);
        getGrid().append(holder);
        holder[0].scrollIntoView(false);
    }

    function yesnoMessage() {
        var holder = $('<div>').addClass('col-xs-6 col-sm-4 col-md-3');
        var btn = $('<a>').addClass('message message-yesno btn btn-default')
            .attr('href', '#').text("Yes");
        btn.click(function(event) {
            handleSpecial('yes', "Yes");
            event.preventDefault();
        });
        holder.append(btn);
        getGrid().append(holder);
        holder = $('<div>').addClass('col-xs-6 col-sm-4 col-md-3');
        btn = $('<a>').addClass('message message-yesno btn btn-default')
            .attr('href', '#').text("No");
        btn.click(function(event) {
            handleSpecial('no', "No");
            event.preventDefault();
        });
        holder.append(btn);
        getGrid().append(holder);
        holder[0].scrollIntoView(false);
    }

    function collapseButtons() {
        $('.message-button, .message-choice, .message-yesno').remove();
    }

    ws.onmessage = function(event) {
        var parsed = JSON.parse(event.data);
        console.log('received ' + event.data);
        switch (parsed.type) {
        case 'text':
            textMessage(parsed.text, parsed.icon);
            currentGrid = null;
            break;

        case 'picture':
            picture(parsed.url, parsed.icon);
            currentGrid = null;
            break;

        case 'rdl':
            rdl(parsed.rdl, parsed.icon);
            currentGrid = null;
            break;

        case 'choice':
            choice(parsed.idx, parsed.title);
            break;

        case 'button':
            buttonMessage(parsed.title, parsed.json);
            break;

        case 'link':
            linkMessage(parsed.title, parsed.url);
            break;

        case 'askSpecial':
            syncCancelButton(parsed);
            if (parsed.ask === 'yesno')
                yesnoMessage();
            break;

        case 'hypothesis':
            $('#input').val(parsed.hypothesis);
            break;

        case 'command':
            $('#input').val('');
            collapseButtons();
            appendUserMessage(parsed.text);
            break;
        }
    };
    ws.onclose = function() {
        console.error('Web socket closed');
        // reconnect here...
    };

    function handleSlashR(line) {
        line = line.trim();
        if (line.startsWith('{'))
            handleParsedCommand(JSON.parse(line));
        else
            handleParsedCommand({ code: line.split(' '), entities: {} });
    }

    function isRecordRequest(text) {
      if (text.includes('bob') === false) {
        return false;
      }
      if (text.includes('blood pressure') === false && text.includes('pressure') === false) {
        return false;
      }
      if (text.includes('record') || text.includes('report') || text.includes('write') || text.includes('measure') || text.includes('for') || text.includes('give') || text.includes('send') || text.includes('take')) {
        return true;
      }
      return false;
    }

    function isOnceADay(text) {
      if (text.includes('once') || text.includes('one time')) {
        return true;
      }
      return false;
    }

    function isTwiceADay(text) {
      if (text.includes('twice') || text.includes('two times')) {
        return true;
      }
      return false;
    }

    function isThriceADay(text) {
      if (text.includes('thrice') || text.includes('three times') || text.includes('with meal') || text.includes('at meal')) {
        return true;
      }
      return false;
    }

    function isMorning(text) {
      if (text.includes('morning') || text.includes('breakfast') || text.includes('wake') || text.includes('waking')) {
        return true;
      }
      return false;
    }

    function isEvening(text) {
      if (text.includes('evening') || text.includes('night') || text.includes('dinner') || text.includes('bed') || text.includes('sleep') || text.includes('sleeping') || text.includes('asleep')) {
        return true;
      }
      return false;
    }

    function isNoon(text) {
      if (text.includes('noon') || text.includes('lunch')) {
        return true;
      }
      return false;
    }

    function handleCommand(text) {
        if (text.startsWith('\\r')) {
            handleSlashR(text.substring(3));
            return;
        }
        if (text.startsWith('\\t')) {
            handleThingTalk(text.substring(3));
            return;
        }
        if (text === 'cat') {
            handleThingTalk(`now => @com.thecatapi.get() => notify;`, text);
            return;
        }
        if (isRecordRequest(text) && isMorning(text) && isEvening(text)) {
            handleThingTalk(`executor = "bob"^^tt:username : { attimer(time=[makeTime(9, 0), makeTime(19, 0)]) => @org.thingpedia.cardiology.patient.record();}`);
            return;
        }
        if (isRecordRequest(text) && isMorning(text)) {
            handleThingTalk(`executor = "bob"^^tt:username : { attimer(time=[makeTime(9, 0)]) => @org.thingpedia.cardiology.patient.record();}`);
            return;
        }
        if (isRecordRequest(text) && isEvening(text)) {
            handleThingTalk(`executor = "bob"^^tt:username : { attimer(time=[makeTime(19, 0)]) => @org.thingpedia.cardiology.patient.record();}`);
            return;
        }
        if (isRecordRequest(text) && isNoon(text)) {
            handleThingTalk(`executor = "bob"^^tt:username : { attimer(time=[makeTime(12, 0)]) => @org.thingpedia.cardiology.patient.record();}`);
            return;
        }
        if (isRecordRequest(text) && isOnceADay(text)) {
            handleThingTalk(`executor = "bob"^^tt:username : { attimer(time=[makeTime(9, 0)]) => @org.thingpedia.cardiology.patient.record();}`);
            return;
        }
        if (isRecordRequest(text) && isTwiceADay(text)) {
            handleThingTalk(`executor = "bob"^^tt:username : { attimer(time=[makeTime(9, 0), makeTime(19, 0)]) => @org.thingpedia.cardiology.patient.record();}`);
            return;
        }
        if (isRecordRequest(text) && isThriceADay(text)) {
            handleThingTalk(`executor = "bob"^^tt:username : { attimer(time=[makeTime(9, 0), makeTime(12, 0), makeTime(19, 0)]) => @org.thingpedia.cardiology.patient.record();}`);
            return;
        }

        ws.send(JSON.stringify({ type: 'command', text: text }));
    }
    function handleParsedCommand(json, title) {
        ws.send(JSON.stringify({ type: 'parsed', json: json, title: title }));
    }
    function handleThingTalk(tt, raw) {
        ws.send(JSON.stringify({ type: 'tt', code: tt, raw: raw }));
    }
    function handleChoice(idx, title) {
        handleParsedCommand({ code: ['bookkeeping', 'choice', String(idx)], entities: {} }, title);
    }
    function handleSpecial(special, title) {
        handleParsedCommand({ code: ['bookkeeping', 'special', 'special:'+special ], entities: {} }, title);
    }

    function appendUserMessage(text) {
        container.append($('<span>').addClass('message message-text from-user')
            .text(text));
        container[0].scrollIntoView(false);
    }

    $('#input-form').submit(function(event) {
        var text = $('#input').val();
        $('#input').val('');

        handleCommand(text);
        event.preventDefault();
    });
    $('#cancel').click(function() {
        handleSpecial('nevermind', "Cancel.");
    });
});
