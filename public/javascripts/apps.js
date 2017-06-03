$(function() {
    $(window).load(function() {
        $('#share-app-dialog').modal('show');
    });

    $('.form-delete-app').on('submit', function() {
        return confirm("Are you sure?");
    });
});
