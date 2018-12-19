/* this file contains global javascript code for all parts of the lmfdb website
   it's just one file for faster page loading */

/* global logger */
function log(msg) {
  if(window.console != undefined) { console.log(msg); }
}

function error(msg) {
  if(window.console != undefined) { console.error(msg); }
}

/* beta logo displayed /w delay, -beta is default, so that it shows up when js
 * is disabled */
//$(function() {
//  $("#logo img").attr("src", '/static/images/lmfdb-logo.png');
//  window.setTimeout(function() {
//    $("#logo img").attr("src", '/static/images/lmfdb-logo-beta.png');
//  }, 2000);
//});

/* code for the properties sidepanel on the right */
/* jquery helper function, rotates element via css3 */
$.fn.rotate = function(rot) {
  this.css("-webkit-transform", "rotate("+rot+"deg)" );
  this.css("-moz-transform", "rotate("+rot+"deg)" );
  this.css("-o-transform", "rotate("+rot+"deg)" );
}

/* jquery helper function, bottom left round corner */
$.fn.round_bl = function(val) {
  this.css("border-bottom-left-radius", val + "px");
  this.css("-moz-border-radius-bottomleft", val + "px");
}

/** collapser: stored height is used to track progress. */
function properties_collapser(evt) {
  evt.preventDefault();
  var $pb = $(".properties-body");
  var $pc = $("#properties-collapser");
  var $ph = $(".properties-header");
  var pb_h = $pb.height();
  $pb.animate({"height": "toggle", "opacity" : "toggle"}, 
    { 
      duration: 50 + 100 * Math.log(100 + $pb.height()),
      step: function() { 
       /* synchronize icon rotation effect */
       var val = $pb.height() / pb_h;
       var rot = 180 - 180 * val;
       $pc.rotate(rot);
       $ph.round_bl(0);
      },
      complete: function () {
        if ($pb.css("display") == "none") {
          $pc.rotate(180);
          $ph.round_bl(10);
        } else { 
          $pc.rotate(0);
        }
      }
    }
  ); //~~ end animate
}


$(function() {
 /* properties box collapsable click handlers */
 $(".properties-header,#properties-collapser").click(function(evt) { properties_collapser(evt); });
 /* providing watermark examples in those forms, that have an 'example=...' attribute */
 /* Add extra spaces so that if you type in exactly the example it does not disappear */
 $('input[example]').each(function(a,b) { $(b).watermark($(b).attr('example')+'   '  ) } )
 $('textarea[example]').each(function(a,b) { $(b).watermark($(b).attr('example')+'   ', {useNative:false}  ) } )
});

/* javascript code for the knowledge db features */
/* global counter, used to uniquely identify each knowl-output element
 * that's necessary because the same knowl could be referenced several times
 * on the same page */
var knowl_id_counter = 0;
/* site wide cache, TODO html5 local storage to cover whole domain
 * /w a freshness timeout of about 10 minutes */
var knowl_cache = {};

function knowl_click_handler($el) {
  // the knowl attribute holds the id of the knowl
  var knowl_id = $el.attr("knowl");
  // the uid is necessary if we want to reference the same content several times
  var uid = $el.attr("knowl-uid");
  var output_id = '#knowl-output-' + uid;
  var $output_id = $(output_id);

  // slightly different behaviour if we are inside a table, but
  // not in a knowl inside a table.
  var table_mode = $el.parents().is("table") && !$el.parents().hasClass("knowl-content");

  // if we already have the content, toggle visibility
  if ($output_id.length > 0) {
    if (table_mode) {
      $output_id.parent().parent().slideToggle("fast");
    }
    $output_id.slideToggle("fast");
    $el.toggleClass("active");

  // otherwise download it or get it from the cache
  } else { 
    $el.addClass("active");
    // create the element for the content, insert it after the one where the 
    // knowl element is included (e.g. inside a <h1> tag) (sibling in DOM)
    var idtag = "id='"+output_id.substring(1) + "'";

    // behave a bit differently, if the knowl is inside a td or th in a table. 
    // otherwise assume its sitting inside a <div> or <p>
    if(table_mode) {
      // assume we are in a td or th tag, go 2 levels up
      var cols = $el.parent().parent().children().length;
      $el.parent().parent().after(
          "<tr><td colspan='"+cols+"'><div class='knowl-output'" +idtag+ ">loading '"+knowl_id+"' …</div></td></tr>");
    } else {
      $el.parent().after("<div class='knowl-output'" +idtag+ ">loading '"+knowl_id+"' …</div>");
    }

    // "select" where the output is and get a hold of it 
    var $output = $(output_id);
    var kwargs = $el.attr("kwargs");

    // cached? (no kwargs or empty string AND kid in cache)
    if((!kwargs || kwargs.length == 0) && (knowl_id in knowl_cache)) {
      log("cache hit: " + knowl_id);
      $output.hide();
      $output.html(knowl_cache[knowl_id]);
      renderMathInElement($output.get(0), katexOpts);
      $output.slideDown("slow");

    } else {
      $output.addClass("loading");
      $output.show();
      log("downloading knowl: " + knowl_id + " /w kwargs: " + kwargs);
      $output.load('/knowledge/render/' + knowl_id + "?" + kwargs,
       function(response, status, xhr) { 
        $output.removeClass("loading");
        if (status == "error") {
          $el.removeClass("active");
          $output.html("<div class='knowl-output error'>ERROR: " + xhr.status + " " + xhr.statusText + '</div>');
        } else if (status == "timeout") {
          $el.removeClass("active");
          $output.html("<div class='knowl-output error'>ERROR: timeout. " + xhr.status + " " + xhr.statusText + '</div>');
        } else {
          knowl_cache[knowl_id] = $output.html();
          $output.hide();

         // if it is the outermost knowl, limit its height of the content to 600px
         if ($output.parents('.knowl-output').length == 0) {
           $(output_id + " div.knowl-content").first().parent().addClass("limit-height");
         }
        }
        // in any case, reveal the new output after math rendering has finished
        renderMathInElement($output.get(0),katexOpts);
        $output.slideDown("slow");
      });
    } // ~~ end not cached
  }
} //~~ end click handler for *[knowl] elements

/** register a click handler for each element with the knowl attribute 
 * @see jquery's doc about 'live'! the handler function does the 
 *  download/show/hide magic. also add a unique ID, 
 *  necessary when the same reference is used several times. */
function knowl_handle(evt) {
      evt.preventDefault();
      var $knowl = $(this);
      if(!$knowl.attr("knowl-uid")) {
        log("knowl-uid = " + knowl_id_counter);
        $knowl.attr("knowl-uid", knowl_id_counter);
        knowl_id_counter++;
      }
      knowl_click_handler($knowl, evt);
  }
$(function() {
  $("body").on("click", "*[knowl]", debounce(knowl_handle,500, true));
});

/*** end knowl js section ***/

/* global ajax event hook, for top right corner */
$(function() {
  var clear_timeout_id = null;
  var start_time = null;
  function clear(hideit, hideimg) {
    if(clear_timeout_id) {
      window.clearTimeout(clear_timeout_id);
      clear_timeout_id = null;
    }
    if (hideimg) $("#communication-img").hide();
    if (hideit) {
      $("#communication").append(" ["+((new Date()).getTime() - start_time) + "ms]");
      clear_timeout_id = window.setTimeout(
         function() {
           $("#communication-wrapper").fadeOut("slow");
         }, 1000);
    } else {
           $("#communication-wrapper").fadeIn("fast");
    }
  }
  $('#communication')
    .bind("ajaxSend", 
      function() { 
         $("#communication-img").fadeIn("slow");
         start_time = (new Date()).getTime(); 
         $(this).text("loading"); clear(false, false); })
    .bind("ajaxComplete", 
      function() { $(this).text("success"); clear(true, true); })
    .bind("ajaxError",
      function() { $(this).text("error"); clear(false, true); })
    .bind("ajaxStop",
      function() { $(this).text("done"); clear(true, true); });
});

function decrease_start_by_count_and_submit_form(form_id) {
  startelem = $('input[name=start]');
  count = parseInt($('input[name=count]').val());
  newstart = parseInt(startelem.val())-count;
  if(newstart<0) 
    newstart = 0;
  startelem.val(newstart);
  pagingelem = $('input[name=paging]');
  if (typeof pagingelem != 'undefined')
    pagingelem.val(1);
  $('form[id='+form_id+']').submit()
};
function increase_start_by_count_and_submit_form(form_id) {
  startelem = $('input[name=start]');
  count = parseInt($('input[name=count]').val());
  startelem.val(parseInt(startelem.val())+count);
  pagingelem = $('input[name=paging]');
  if (typeof pagingelem != 'undefined')
    pagingelem.val(1);
  $('form[id='+form_id+']').submit()
};

function get_count_of_results() {
    var address = window.location.href
    $("#result-count").html("computing...");
    $("#download-msg").html("Computing number of results...");
    if (address.slice(-1) === "#")
        address = address.slice(0,-1);
    address += "&result_count=1";
    $.ajax({url: address, success: get_count_callback});
};

function get_count_callback(res) {
    $('#result-count').html(res['nres']);
    if (parseInt(res, 10) > 100000) {
        $("#download-msg").html("There are too many search results for downloading.");
    } else {
        $("#download-msg").html("");
        $("#download-form").show();
    }
};



/**
 * https://github.com/component/debounce
 * Returns a function, that, as long as it continues to be invoked, will not
 * be triggered. The function will be called after it stops being called for
 * N milliseconds. If `immediate` is passed, trigger the function on the
 * leading edge, instead of the trailing. The function also has a property 'clear' 
 * that is a function which will clear the timer to prevent previously scheduled executions. 
 *
 * @source underscore.js
 * @see http://unscriptable.com/2009/03/20/debouncing-javascript-methods/
 * @param {Function} function to wrap
 * @param {Number} timeout in ms (`100`)
 * @param {Boolean} whether to execute at the beginning (`false`)
 * @api public
 */
function debounce(func, wait, immediate){
	var timeout, args, context, timestamp, result;
	if (null == wait) wait = 100;

	function later() {
		var last = Date.now() - timestamp;

		if (last < wait && last >= 0) {
			timeout = setTimeout(later, wait - last);
		} else {
			timeout = null;
			if (!immediate) {
				result = func.apply(context, args);
				context = args = null;
			}
		}
	};

	var debounced = function(){
		context = this;
		args = arguments;
		timestamp = Date.now();
		var callNow = immediate && !timeout;
		if (!timeout) timeout = setTimeout(later, wait);
		if (callNow) {
			result = func.apply(context, args);
			context = args = null;
		}

		return result;
	};

	debounced.clear = function() {
		if (timeout) {
			clearTimeout(timeout);
			timeout = null;
		}
	};

	debounced.flush = function() {
		if (timeout) {
			result = func.apply(context, args);
			context = args = null;

			clearTimeout(timeout);
			timeout = null;
		}
	};

	return debounced;
};
