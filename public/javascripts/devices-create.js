$(function() {
    function handleDeviceFactory(json, kind) {
        var placeholder = $('#device-placeholder');

        placeholder.empty();

        switch(json.type) {
        case 'form':
            json.fields.forEach(function(field) {
                var input = $('<input>').addClass('form-control')
                    .attr('type', field.type).attr('name', field.name);
                var label = $('<label>').addClass('control-label').text(field.label);
                var div = $('<div>').addClass('form-group').append(label).append(input);
                placeholder.append(div);
            });
            placeholder.append($('<button>').addClass('btn btn-primary')
                               .attr('type', 'submit').text("Configure"));
            break;
        case 'link':
            placeholder.append($('<p>').append($('<a>').addClass('btn btn-primary')
                                               .attr('href', json.href).text(json.text)));
            break;
        case 'oauth2':
            placeholder.append($('<p>').append($('<a>').addClass('btn btn-primary')
                                               .attr('href', '/devices/oauth2/' + kind)
                                               .text(json.text)));
            break;
        }
    }

    function handleOnlineAccountFactory(json, kind, name) {
        console.log('Handling online account ' + kind);
        var self = $('<div>');
        self.addClass('online-account-choice col-md-4');

        var btn = $('<a>');
        btn.addClass('btn btn-default btn-block');
        btn.text(name);
        self.append(btn);

        switch(json.type) {
        case 'form':
            var form = $('<div>');
            form.addClass('online-account-expander collapse');
            form.attr('id', 'online-account-' + kind);
            form.attr('aria-expanded', 'false');

            json.fields.forEach(function(field) {
                var input = $('<input>').addClass('form-control')
                    .attr('type', field.type).attr('name', field.name);
                var label = $('<label>').addClass('control-label').text(field.label);
                var div = $('<div>').addClass('form-group').append(label).append(input);
                form.append(div);
            });
            form.append($('<button>').addClass('btn btn-primary')
                        .attr('type', 'submit').text("Configure"));
            btn.attr('data-toggle', 'online-account-' + kind);
            form.collapse('hide');
            btn.on('click', function() { form.collapse('toggle'); });
            self.append(form);
            break;
        case 'link':
            btn.attr('href', json.href);
            break;
        case 'oauth2':
            btn.attr('href', '/devices/oauth2/' + kind);
            break;
        }

        return self;
    }

    $('#online-account-selector').each(function() {
        var selector = $(this);

        var developerKey = $('#developer-key').text();
        var url = ThingEngine.getThingPedia() + '/thingpedia/api/devices?class=online&developer_key='
            + developerKey;
        $.get(url, function(factoryList) {
            for (var i = 0; i < factoryList.length; i += 3) {
                var row = $('<div>').addClass('row');
                selector.append(row);

                for (var j = 0; j < Math.min(3, factoryList.length - i); j++) {
                    var f = factoryList[i + j];
                    row.append(handleOnlineAccountFactory(f.factory, f.primary_kind, f.name));
                }
            }
        });
    });

    $('#device-kind').each(function() {
        var selector = $(this);
        var deviceFactories = {};

        var developerKey = $('#developer-key').text();
        var url = ThingEngine.getThingPedia() + '/thingpedia/api/devices?class=physical&developer_key='
            + developerKey;
        $.get(url, function(factoryList) {
            factoryList.forEach(function(f) {
                deviceFactories[f.primary_kind] = f.factory;

                selector.append(function() {
                    var self = $('<option>');
                    self.val(f.primary_kind);
                    self.text(f.name);
                    return self;
                });
            });

            $('#device-kind').change(function() {
                var val = $('#device-kind').val();
                if (!val) {
                    $('#device-placeholder').hide();
                    return;
                }

                $('#device-placeholder').show();
                handleDeviceFactory(deviceFactories[val], val);
            });
        });
    });

    $('#device-placeholder').hide();
});
