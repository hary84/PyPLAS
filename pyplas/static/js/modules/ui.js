// Add internal-link in sidemenu
function addSideLink() {
    var $linkBox = $("div.internal-link-box")
    // .internal-link-boxにh2の値を並べる
    $(".jplas").children('h2').each(function(){

        var $a = $("<a />");
        $a.attr({"href": "#"+$(this).attr("id"),
                 "class": `link-${$(this).attr("id")}`});
        $a.text($(this).text());
        $linkBox.before($a);
    });

    // .internal-link-boxにh5の値を並べる
    $(".jplas").find('h5').each(function(){

        $(this).attr("id", $(this).text())
        var $a = $("<a />");
        $a.attr({"href": "#"+$(this).attr("id"),
                 "class": `src-internal-link`});
        $a.text($(this).text());
        $linkBox.append($a);
    });	
}

// Fix sidemenu when scrolling down
function fixSidemenu(top){
    var $sidemenu = $(".js-sidemenu")
    var scrollTop = $(window).scrollTop();
    var width = $(window).width();
    if(width >= 768 && scrollTop > top){
        $sidemenu.addClass('fixed');
    }
    else{
        $sidemenu.removeClass('fixed');
    }
    $sidemenu.width($sidemenu.parent().width());
}