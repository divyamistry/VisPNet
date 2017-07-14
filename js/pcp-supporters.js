/* fill the URL text field with sampel network URLs */
$("#sample-network1").on("click",function(){
	// H.pylori ppi network
  // $("#csv-file-url").val("https://dl.dropboxusercontent.com/u/59758/SimPPI-sample-net.csv")
	// $("#csv-file-url").val("https://dl.dropboxusercontent.com/u/59758/physical_ppi_table_f.csv");
	$("#csv-file-url").val("https://raw.githubusercontent.com/divyamistry/VisPNet/eb0aca34ef43e907ca091121b856e21013a68d23/data/SimPPI-sample-net.csv");
});
/* $("#sample-network2").on("click",function(){
	// human diseasome
	$("#csv-file-url").val("");
});
$("#sample-network3").on("click",function(){
	// yeast coexpression network
	$("#csv-file-url").val("");
});
$("#sample-network4").on("click",function(){
	// multiple time point network
	$("#csv-file-url").val("");
}); */

/* ****
  Following functions for the index.html
**** */
/* progress-bar processing */
function notify(){
	var remaining_paths = pc_progressive.remaining();
	if (remaining_paths < 0) {
		$(".progress-bar").removeClass("progress-bar-striped").text("Done.");
		return true;
	}
	
	//var pct_complete = (100*(max_paths-remaining_paths))/max_paths;
	$(".progress-bar").addClass("progress-bar-striped").text("Processing...");
}

/* When clicking to load csv file, show the loading text on button */
var parsed_csv_data; // this is in global scope because it is used several times
                      //   and therefore makes sense to store it instead of requesting
                      //   the same data again.
$("#csv-process-btn").on("click",function(){
	var csvurl = $("#csv-file-url").val();
	
	//if the URL is empty, do nothing
	if(csvurl=="") { return false; }
	
	//hide the error if it's open from previous click.
	$("#file-access-alert").hide();
	
	//Show the button as loading the file at URL
	$("#csv-process-btn").button('loading');
	
	// get the file and start processing
	// d3.csv('data/physical_ppi_table.csv').get().on("error", function(){
	d3.csv(csvurl).get().on("error", function(){
		$("#file-access-alert").show();
		$("#csv-process-btn").button('reset');
	} ).on("load",function(rows){
		parsed_csv_data = rows;
		$("#csv-file-url").prop('disabled', true);
		$("#csv-process-btn").html('Done!').prop('disabled', true);
		$("#total-items").text(parsed_csv_data.length || 0);

		// once the data has been loaded, we can display the pcp
		$("#pcp-hint").show();
		$("#linnetpcp").show();
		$("#result-table").show();
		$("#helpinfo").show();

		// start drawing the pcp
		$(".progress-bar").show();
		draw_pcp();
		
		// once we start drawing the pcp, enable search form
		$("#namesearch").prop('disabled',false);
		// disable sample buttons, because they're irrelvant. Don't want to 
		//   hint at the user that sample networks can be changed without
		//   reloading the page.
		$(".samplebtn").prop('disabled',true);
	});
});

/* if the window is resized, we redraw the plot.
   Unfortunately, the plot won't remember brush position for now.
*/
$(window).resize(function(){
	if(pc_progressive) {
		pc_progressive.width($("#linnetpcp").width()).height($("#linnetpcp").height());
		pc_progressive.updateAxes();
  }
	
});

/* If HTML5 File API is available, let user 
   pick local files */
$(function(){
	// Check for the various File API support.
	if (window.File && window.FileReader && window.FileList && window.Blob) {
		// Great success! All the File APIs are supported.
		console.log("File APIs support available.");
	} else {
		alert('The File APIs are not fully supported in this browser.');
	}
	
	// empty the URL box
	$("#csv-file-url").val("");
	//allow user input for URL
	$("#csv-file-url").prop('disabled', false);
	
	// show help for URL 
	$('[data-toggle="popover"]').popover();
});

/* For the tabbed ui with table and other plot choices
*/
    jQuery(document).ready(function ($) {
        $('#tabs').tab();
    });

/* Searching the table content
This response is based on dystroy's comment on stackoverflow
   at http://stackoverflow.com/questions/10318575/jquery-search-as-you-type-with-ajax#comment13283982_10318661 */
var thread = null;
var prevsearch=null;
$("#namesearch").keyup(function(){
	// I'm going to compare search term to older query 
	// and avoid rerunning search if nothing has changed.
	//   or if the query was empty
	var currsearch = $(this).val();
	if(currsearch == prevsearch) {
		// console.log('avoided fake run');
		return;
	}
	
	// Any lingering table formatting from previous should be fixed first
	$("#tablepcprows tr").removeClass("success").show();
	
	// if query was emptied by this time, return
	if(currsearch.length == 0) {
		return;
	}
	
	prevsearch = currsearch;
	
	clearTimeout(thread); // I want to wait for half a second before I shoot out query. User may still be typing
	thread = setTimeout(function(){
		searchlist = [];
		$.each(pc_progressive.brushed(), function(idx, elem){
			var found = false;
			$.each(elem, function(key, kval){
				if(kval.toLowerCase().indexOf($("#namesearch").val().toLowerCase()) != -1) {
					found=true;
				}
			});
			
			if(found) { // if there was a match in the table, we just highlight the rows
				$("#tablepcprows tr:nth-child(" + (idx+1) + ")").addClass("success");
			} else { // temporarily hide unmatched table rows
				$("#tablepcprows tr:nth-child(" + (idx+1) + ")").hide();
				//(idx+1) because nth-child starts from 1, unlike idx that starts at 0
			}
		});
	}, 500); // half-second time out
});