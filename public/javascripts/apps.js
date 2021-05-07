$(function() {
    $('.form-delete-app').on('submit', function() {
        return confirm("Are you sure?");
    });
    $(window).scroll(function() {
        if ($(window).scrollTop() > 100) {
            $('#back_top').removeClass('hidden');
            console.log("hidden")
        } else {
            console.log("not hidden")
            $('#back_top').addClass('hidden')
        }
    });
});