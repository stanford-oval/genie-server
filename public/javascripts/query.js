$(function() {
    var ws = null;

    $('#run').on('click', function() {
        if (ws)
            ws.close();

        var code = $('#code').val();
        console.log('Code: ' + code);
        ws = new WebSocket('ws://127.0.0.1:3000/query/' + encodeURIComponent(code));
        ws.onmessage = function(messageEvent) {
            $('#results').val(messageEvent.data);
        };
        ws.onclose = function() {
            ws = null;
        };
    });
});
