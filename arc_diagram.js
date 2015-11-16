/* GLOBALS */

var width  = 960;             // width of svg image
var height = 400;             // height of svg image
var margin = 20;              // amount of margin around plot area
var pad = margin/2;           // actual padding amount
var yoffset = 30;             // fixed node radius
var yfixed = height - margin  - yoffset;  // y position for all nodes

var cscale = d3.scale.category20();
var colormap = {"PROG":1, "VIEW":3, "FUNC":15, "TCOD":7, "TTAB":1, "STRU":5, "TABL":15, "DTEL":6, "TTYP":15, "INCL":4, "METH":11, "FUGR":18 };
var color = function(group){return cscale(colormap[group]);};
var orders = {};
var x = d3.scale.ordinal().rangeBands([margin,width - margin]);
var svg;

/* HELPER FUNCTIONS */

// Generates a tooltip for a SVG circle element based on its ID
function addTooltip(circle) {
    var x = parseFloat(circle.attr("cx"));
    var y = parseFloat(circle.attr("cy"));
    var r = parseFloat(circle.attr("r"));
    var text = circle.attr("id");

    var tooltip = d3.select("#plot")
        .append("text")
        .text(text)
        .attr("x", x)
        .attr("y", y)
        .attr("dy", margin*1.5)
        .attr("id", "tooltip");

    var offset = tooltip.node().getBBox().width / 2;

    if ((x - offset) < 0) {
        tooltip.attr("text-anchor", "start");
        tooltip.attr("dx", -r);
    }
    else if ((x + offset) > (width - margin)) {
        tooltip.attr("text-anchor", "end");
        tooltip.attr("dx", r);
    }
    else {
        tooltip.attr("text-anchor", "middle");
        tooltip.attr("dx", 0);
    }
}

 d3.select("#order").on("change", function() {
    // clearTimeout(timeout);
    order(this.value);
  });


/* MAIN DRAW METHOD */

// Draws an arc diagram for the provided undirected graph
function arcDiagram(graph) {
    // create svg image
    svg = d3.select("body")
        .append("svg")
        .attr("id", "arc")
        .attr("width", width)
        .attr("height", height)
        .call(d3.behavior.zoom()
            .scaleExtent([1, 1000])
            .on("zoom", zoom)
            .on("zoomend", zoomEnd)
            );

    // draw border around svg image
    svg.append("rect")
        .attr("class", "outline")
        .attr("width", width)
        .attr("height", height)
        .attr("fill","black")
        .on("click",function(){
            reset_color();
        });

    svg.append("line")          // attach a line
        .style("stroke", "black")  // colour the line
        .attr("stroke-width", 0.25)  // colour the line
        .attr("x1", 0)     // x position of the first end of the line
        .attr("y1", height - yoffset - pad)      // y position of the first end of the line
        .attr("x2", width)     // x position of the second end of the line
        .attr("y2", height - yoffset - pad); 

    // create plot area within svg image
    var plot = svg.append("g")
        .attr("id", "plot")
        .attr("transform", "translate(" + pad + ", " + pad + ")");

    // Filter edges with null source/target
    graph.edges = graph.edges.filter(function(d){
        return (d.source in graph.nodes && d.target in graph.nodes)}
        );

    // fix graph links to map to objects instead of indices
    graph.edges.forEach(function(d, i) {
        d.source = graph.nodes[d.source];
        d.target = graph.nodes[d.target];
        
        d.source.degree = ++d.source.degree || 0;
        d.target.degree = ++d.target.degree || 0;
        d.source.children = d.source.children || [];
        d.target.parents = d.target.parents || [];
        d.source.children.push(d.target);
        d.target.parents.push(d.source);
    });

    var n  = Object.keys(graph.nodes).length;
    var keys  = Object.keys(graph.nodes);

    orders = {
        name:   Object.keys(graph.nodes).sort(function(a, b) { return d3.ascending(graph.nodes[a].name, graph.nodes[b].name); }),
        group:  Object.keys(graph.nodes).sort(function(a, b) { return graph.nodes[b].group - graph.nodes[a].group; }),
        degree: Object.keys(graph.nodes).sort(function(a, b) { return graph.nodes[b].degree - graph.nodes[a].degree} ),
        value:  Object.keys(graph.nodes).sort(function(a, b) { return graph.nodes[b].degree - graph.nodes[a].degree} ),
        // value:  Object.keys(graph.nodes).sort(function(a, b) { return graph.nodes[b].value - graph.nodes[a].value} ),
    };

    x.domain(orders.group)
    d3.values(graph.nodes);
    // draw links first, so nodes appear on top
    drawLinks(graph.edges);

    // draw nodes last
    drawNodes(graph.nodes);

    var items = d3.selectAll(".link, .node");
    function zoom(){    
        var s = d3.event.scale;
        var t = d3.event.translate[0];
        var tx = Math.min(0, Math.max(width * (1 - s), t));
        var xmin = margin + tx;
        var xmax = tx + s*(width - margin);
        x.rangeBands([xmin,xmax]);

        var visible_nodes =  d3.values(graph.nodes).filter(function(d){
            return x(d.id) >= -10 && x(d.id) <= width;
        });

        var visible_edges = graph.edges.filter(function(d){
            return (visible_nodes.indexOf(d.source) > -1) || 
            (visible_nodes.indexOf(d.target) > -1);
        });

        d3.selectAll(".link").style("visibility","hidden");
        drawLinks(visible_edges);
        drawNodes(visible_nodes);


    }
}
// Draws nodes on plot
function drawNodes(nodes) {
    // used to assign nodes color by group
    var circles =  d3.select("#plot").selectAll(".node")
        .data( d3.values(nodes), function(d) {return d.id;})
        .attr("cx", function(d) { return x(d.id) });

    circles.enter()
        .append("circle")
        .attr("class", function(d){return "node " + d.name})
        .attr("id", function(d) { return d.name; })
        .attr("cx", function(d) { return x(d.id) })
        .attr("cy", yfixed )
        .attr("r",  function(d,i) { return 10 })
        .style("fill",   function(d) { return color(d.group); })
        .on("mouseover", function(d) { 
            var sel = d3.select(this);
            sel.style("stroke","grey")
            addTooltip(sel);
        })
        .on("mouseout",  function(d, i) { 
            d3.select(this).style("stroke","white")
            d3.select("#tooltip").remove(); 
        })
        .on("click",function(d){
            d3.selectAll("circle:not(."+d.name+")")
                .transition()
                .duration(200)
                .style("fill","lightgrey");
            d3.selectAll(".link:not(."+d.name+")")
                .transition()
                .duration(200)
                .style("stroke-width",1.75)
                .style("stroke-opacity",.75)
                .style("stroke","lightgrey");
            d3.selectAll("circle."+d.name)
                .transition()
                .duration(200)
                .style("fill",function(d) {return color(d.group);})
            d3.selectAll(".link."+d.name)
                .transition()
                .duration(200)
                .style("stroke-width",3)
                .style("stroke-opacity",1)
                .style("stroke", function(d) {return color(d.source.group)})
        })
        .on("dblclick",function(d){
           reset_color();
        });

    circles.exit().remove();

    }

// Draws nice arcs for each link on plot
function drawLinks(links) {
    // add links
    var links = d3.select("#plot").selectAll(".link")
        .data(links)
        .attr("d", linkArc);
    links.enter()
        .append("path")
        .attr("class", function(d){return "link " + d.source.name + " " + d.target.name})
        .attr("id", function(d){return ""})
        .style("opacity",1)
        .style("stroke", function(d) {return color(d.source.group)})
        .attr("d", linkArc)
        .attr("stroke-width",1.75);
    links.exit().remove();   
}

function linkArc(d) {
      var start = x(d.source.id);
      var end   = x(d.target.id); 
      var dx = start - end,
          dr = 0.55*dx
      if (dx < 0){
        return "M" + start + "," + yfixed + "A" + dr + "," + dr + " 0 0,1 " + end + "," + yfixed; 
      }
      else{
        return "M" + end + "," + yfixed + "A" + dr + "," + dr + " 0 0,1 " + start + "," + yfixed;  
      } 
    }

function order(value){
    x.domain(orders[value]);

    var t = svg.transition().duration(750);

    t.selectAll("circle")
        .attr("cx", function(d) { return x(d); });

    // t.selectAll("path")
    //     .delay(function(d,i){return i*1.5})
    //     .attr("d", linkArc); 
}

function get_parents(elem){
    if (!elem.parents || elem.parents.length === 0) return [];
    var p = elem.parents;
    elem.parents.forEach(function(d){
        p.concat(get_parents(d));
    });
    return p;
}


function zoomEnd(){
    d3.selectAll(".link").style("visibility","visible");
}

function reset_color(){
     d3.selectAll("circle")
                .transition()
                .duration(200)
                .style("fill",function(d) {return color(d.group);});    
    d3.selectAll(".link")
                .transition()
                .duration(200)
                .style("stroke-width",1.75)
                .style("stroke", function(d) {return color(d.source.group)})
}