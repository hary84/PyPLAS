

$(function() {
    addSideLink() //=> modules/ui.js

    $("a[href='#code']").click(function() {
        $(".internal-link-box").toggle()
		$(this).toggleClass("open")
    })

    const top = $(".js-sidemenu").offset().top
	$(window)
		.scroll(function(){
			fixSidemenu(top); //=> modules/ui.js
		})
		.resize(function(){
			fixSidemenu(top);
		});
	fixSidemenu(top);

	$("#close").on("click", function() {
		removePopUp()
	}) 
    $(".popup").click(function(event) {
        if (event.target.closest(".content") == null) {
            $("#close").trigger("click")
        }
    })
})