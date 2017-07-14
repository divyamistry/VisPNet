// parallel plot
var pc_progressive; // this has to be in golbal scope because various update
                    //   functions need to act on this object.
                    //   Unfortunately, there's no straight-forward other way
                    //   to get reference to this object.

// function to draw the parallel coordinate plot using given colors
function draw_pcp(){
  var colorby = "Experimental.System";
  // var colorby = "class";

  // create the parallel coordinate plot using the d3.parcoords() library
  pc_progressive = d3.parcoords()("#linnetpcp")
                     .data(parsed_csv_data)
                     .color(pick_colors(colorby)) // Pick colors based on "Experimental System"
                                                  //   that was used for PPI edge BioGRID data
                                                  //   provides this detail
                     .alpha(0.4)
                     .margin({top:60, left:0, bottom:10, right:0})
                     .mode("queue")   // this is the magic to allow incremental edge display
                     .render()
                     .brushMode("1D-axes") // we'll only be brushing vertically along the axes
                     .reorderable(); // axes can be dragged to change the order of display
                     // .interactive(); // For debugging
  setInterval(notify,50);

  pc_progressive.svg.selectAll("text").style("font", "10px sans-serif"); // all text on the graph is 10px

  // When the axes get brushed, we need to update table, and redraw the node-link layout
  pc_progressive.on("brushend", function(d) {
                    // if more than 100 rows, make a truncated table.
                    var sampledata = d.slice(0,500);
                    update_selection_counter(d.length);
                    update_table(sampledata, pc_progressive);
                    update_nodelink(d);
                    setInterval(notify);
                   });
}

// Choose colors for edges based on chosen group column / metadata from CSV file
//   I return a function that can be passed on directly to the d3.parcoord.color()
function pick_colors(group_name){
  var colors = {}; // colors for various "types"/groupings of edges if metadata allows for it
  var colorgen = d3.scale.category20b(); // funciton to generate the colors

  // I want to color the edges based on the group_name
  _(parsed_csv_data).chain().pluck(group_name).uniq()
         .each(function(d,i){
           colors[d] = colorgen(i);
         });
  return function(d) { return colors[d[group_name]]; };
}

// Update the data table with the given rows
// This is called after brushing the plot, and also after search
function update_table(rows, pc_progressive){
	// if there are more than 10 rows, we'll create
  // a scrollable table with limited viewport of 500px
  if(rows.length>10){
	  $(".scrollable-table").height(500);
  } else {
	  $(".scrollable-table").height("auto");
  }

	// If brushed result was empty, user is still allowed to keep brushing
	//   other axes, but in case of no results for rows, we want to just
	//   move out of this function without updating anything. This can be
	//   done at the beginning of the function, but I want to get the table
	//   to resize to its "auto" size for empty result set, and not doing this checked
	//   in the previous if..else just keeps things cleaner/easier to read.
	if (!rows || rows.length == 0) {
		//empty the result table and return from the function
		$("#tablepcprows").html("");
		return;
	}

  // write the table header
  d3.select("#tablepcphead").html("").selectAll("th")
    .data(Object.keys(pc_progressive.data()[0])).enter().append("th").text(function(d){ return d;});

  // write the rows
  var table = d3.select("#tablepcprows").html("").selectAll("tr")
                .data(rows).enter().append("tr")
                .on("mouseover", function(d) {pc_progressive.highlight([d]);})
                .on("mouseout", function(d)  {pc_progressive.unhighlight([d]);});

  $.each(Object.keys(rows[0]), function(idx,propname){
	  table.append("td").text(function(d) { return d[propname]; });
  });
}

// Based on brushing the PCP, update the brushed items counter
function update_selection_counter(selection_size) {
  $("#filtered-items").text(selection_size);
}

// Based on brushing the PCP, if the network is small enough (defined by node_link_maxsize variable)
//   show it as a node-link diagram
var nodeAColumn = "Interactor.A", nodeBColumn = "Interactor.B"; //globally defined because they're used often.
function update_nodelink(rows){
  var node_link_maxsize = 400; //limit on number of edges
  if (rows.length < node_link_maxsize) {
    var links=[]; // empty the list of edges
    var nodes=[]; // empty the list of nodes

    // Get list of node names, using which we'll create list of nodes. This is the set-union of nodes involved in edges
    var node_names = _.union(_(rows).pluck(nodeAColumn),_(rows).pluck(nodeBColumn));
    // Populate the nodes list with objects
    _(node_names).each(function(d){ nodes.push({"name":d}) });

    // Populate the list of edges with "source" and "target" properties for d3.force layout
    // The force layout needs nodes as integer ids, and not the string names, so here I'm
    //   using the indexOf() sadness for looking up the node id.
    //TODO at some point, I should encode the node ids into the incoming CSV. Or just create objects with the ids pre-defined.
    _(rows).each(function(d,i){
      links.push(
        {"source":_(nodes).pluck("name").indexOf(d[nodeAColumn]),
         "target":_(nodes).pluck("name").indexOf(d[nodeBColumn])}
      );
    });

    // Create space on the page to hold the graph
    // Also adding a range-slider to modify the gravity
    var default_gravity = 0.2; // default value for the gravity slider and the force-layout gravity.
    var force_graph = d3.select("#forcenet").html("<input type='range' name='forcenet-gravity' value='" + (default_gravity*100) +"'></input>").append("svg")
                                            .attr("width", $("#forcenet").width())
                                            .attr("height", $("#forcenet").height())
                                            .attr("overflow","auto");

    // Create the layout that acts upon the node/link data
    var force_layout = d3.layout.force().gravity(default_gravity)
                             .distance(100)
                             .charge(-100)
                             .size([$("#forcenet").width(), $("#forcenet").height()]);
    // Assign the nodes and edges for the layout
    force_layout.nodes(nodes).links(links).start();

    // Draw the nodes and edges
    var link = force_graph.selectAll(".link").data(links).enter().append("line").attr("class","link");
    var node = force_graph.selectAll(".node").data(nodes).enter().append("g").attr("class","node").call(force_layout.drag);

    // show node as circles, and show the protein name as label.
    node.append("circle").attr("r",5)
    node.append("text").attr("dx",12).attr("dy","1em").text(function(d) { return d.name; });

    // Update the positions of edges at each "tick".
    force_layout.on("tick", function(){
      link.attr("x1", function(d){return d.source.x; })
          .attr("y1", function(d){return d.source.y; })
          .attr("x2", function(d){return d.target.x; })
          .attr("y2", function(d){return d.target.y; });
      // Update the position of nodes at each "tick".
      node.attr("transform", function(d){ return "translate(" + d.x + "," + d.y + ")"; });
    });

    // When the gravity slider changes, change the gravity of node-link diagram
    $("input[name=forcenet-gravity]").change(function(){
      force_layout.gravity($(this).val()/100).start();
    });

  } else { // If there are too many edges to show, display a notice asking user to make smaller brushed data choice.
    d3.select("#forcenet").html("").append("h3").text("Node-Link layout");
    d3.select("#forcenet").append("text").attr("style","color:red").text("Need a selection smaller than " + node_link_maxsize + " edges.")
  }
}

/*
 * Some extra catch-all scrap work for sample use.
 */
//TODO window.onresize should rescale the viewer


