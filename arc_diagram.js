/* GLOBALS */

var width  = 960;             // width of svg image
var height = 400;             // height of svg image
var margin = 20;              // amount of margin around plot area
var pad = margin/2;           // actual padding amount
var yoffset = 30;             // fixed node radius
var yfixed = height - margin  - yoffset;  // y position for all nodes
var orders = {};

// Get colours
var groups = ["PROG","VIEW","FUNC","TCOD","TTAB","STRU","TABL","DTEL","TTYP","INCL","METH","FUGR"];
var color = {};
var light_color = {};
groups.forEach(function(d,i){var c = d3.scale.category20c().range()[i];color[d] = c;light_color[d] = tinycolor(c).lighten(35);});

var x = d3.scale.ordinal().rangeBands([margin,width - margin]);
var svg;
var canvas;


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

/* MAIN DRAW METHOD */

// Draws an arc diagram for the provided undirected graph
function arcDiagram(graph) {

    canvas = d3.select("canvas")
       .attr("width",width)
       .attr("height",height)
       .node().getContext("2d");
    canvas.globalAlpha=0.5;

    // create svg image
    svg = d3.select(".svg")
        .attr("id", "arc")
        .attr("width", width)
        .attr("height", height)
        .call(d3.behavior.zoom()
            .scaleExtent([1, 1000])
            .on("zoom", zoom));

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

    var nodes  = svg.append("g")
        .attr('id', "nodes");

    // Filter links with null source/target
    graph.links = graph.links.filter(function(d){
        return (d.source in graph.nodes && d.target in graph.nodes);}
        );

    graph.links.forEach(function(d, i) {
        d.source = graph.nodes[d.source];
        d.target = graph.nodes[d.target];
        d.source.degree = ++d.source.degree || 0;
        d.target.degree = ++d.target.degree || 0;
        d.source.children = d.source.children || [];
        d.target.parents = d.target.parents || [];
        d.source.children.push(d.target);
        d.target.parents.push(d.source);
    });

    d3.select("#links_checkbox").on("change", function() {
      if(this.checked){
        canvas.clearRect(0, 0, width, height);
    }
      else{
        drawLinks(graph.links);
    }
  });

    orders = {
        name:   Object.keys(graph.nodes).sort(),
        group:  Object.keys(graph.nodes).sort(function(a, b) { return graph.nodes[b].group - graph.nodes[a].group;}),
        degree: Object.keys(graph.nodes).sort(function(a, b) { return graph.nodes[b].degree - graph.nodes[a].degree;} ),
    };

    x.domain(orders.name);

    d3.select("#order").on("change", function() {
            x.domain(orders[this.value]);
            canvas.save();
            canvas.clearRect(0, 0, width, height);
            var t = svg.transition().duration(1000);

            t.selectAll("circle")
                .delay(function(d,i){return i*0.5;})
                .attr("cx", function(d) { return x(d.id); })
                .each("end", function(d){
                    if(d.parents){
                        d.parents.forEach(function(c){
                            _draw_arc(x(d.id),x(c.id),light_color[c.group]);
                        });
                    }
            });   
      });

    // draw links first, so nodes appear on top
    drawLinks(graph.links);

    // draw nodes last
    drawNodes(graph.nodes);

    var myNodes = nodes.selectAll(".node");

    function zoom(){    
        var s = d3.event.scale;
        var t = d3.event.translate[0];
        var tx = Math.min(0, Math.max(width * (1 - s), t));
        var xmin = margin + tx;
        var xmax = tx + s*(width - margin);
        x.rangeBands([xmin,xmax]);
        if(!d3.selectAll('#links_checkbox').property('checked') ){
            canvas.save();
            canvas.clearRect(0, 0, width, height);
            drawLinks(graph.links);
            canvas.restore();       
        }
        myNodes.attr("cx", function(d) { return x(d.id);});
        }

}

// Draws nodes on plot
function drawNodes(nodes) {
    // used to assign nodes color by group
    // var circles =  d3.select("#plot").selectAll(".node")
    var circles =  d3.select("#nodes").selectAll(".node")
        .data( d3.values(nodes), function(d) {return d.id;});
    circles.enter()
        .append("circle")
        .attr("class", function(d){return "node " + d.id;})
        .attr("id", function(d) { return d.id; })
        .attr("cx", function(d) { return x(d.id);})
        .attr("cy", yfixed + 10 )
        .attr("r",  function(d,i) { return 10;})
        .style("fill",   function(d) { return color[d.group]; })
        .on("mouseover", function(d) { 
            var sel = d3.select(this);
            sel.style("stroke","grey");
            addTooltip(sel);
        })
        .on("mouseout",  function(d, i) { 
            d3.select(this).style("stroke","white");
            d3.select("#tooltip").remove(); 
        })
        .on("click",function(d){
            d3.selectAll("circle:not(."+d.id+")")
                .transition()
                .duration(200)
                .style("fill","lightgrey");
            d3.selectAll(".link:not(."+d.id+")")
                .transition()
                .duration(200)
                .style("stroke-width",1.75)
                .style("stroke-opacity",0.75)
                .style("stroke","lightgrey");
            d3.selectAll("circle."+d.id)
                .transition()
                .duration(200)
                .style("fill",function(d) {return color[d.group];});
            d3.selectAll(".link."+d.id)
                .transition()
                .duration(200)
                .style("stroke-width",3)
                .style("stroke-opacity",1)
                .style("stroke", function(d) {return color[d.source.group];});
        })
        .on("dblclick",function(d){
           reset_color();
        });

    circles.exit().remove();

    }


// Draws arcs for each link on plot
function drawLinks(links) {
    links.forEach(function(d){
        if(viewable(d.source.id) || viewable(d.target.id)){
            _draw_arc(x(d.source.id),x(d.target.id),light_color[d.source.group]);
        }
    });
}

function _draw_arc(start,end,color){
     canvas.beginPath();
     var rel_dist = Math.abs(start - end) / width; 
     var ycontrol = yfixed * (1 - rel_dist) ;
     var center = (start + end)/2;
     canvas.moveTo(start,yfixed);
     canvas.quadraticCurveTo(center, ycontrol, end, yfixed);
     canvas.strokeStyle = color;
     canvas.stroke();
}

function get_parents(elem){
    if (!elem.parents || elem.parents.length === 0) return [];
    var p = elem.parents;
    elem.parents.forEach(function(d){
        p.concat(get_parents(d));
    });
    return p;
}

function viewable(d){
    return (x(d) > -width && x(d) < width*2); 
}

function reset_color(){
     d3.selectAll("circle")
        .transition()
        .duration(200)
        .style("fill",function(d) {return color[d.group];});    
}