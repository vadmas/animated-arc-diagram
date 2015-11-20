(function() {
// SAP Dashboard object
sapdash = {};

/* GLOBALS */

var width  = 960;             // width of svg image
var height = 400;             // height of svg image
var margin = 20;              // amount of margin around plot area
var yoffset = 30;             // Offset from bottom
var yfixed = height - margin  - yoffset;  // y position for all nodes

// Get colours
var groups = ["PROG","VIEW","FUNC","TCOD","TTAB","STRU","TABL","DTEL","TTYP","INCL","METH","FUGR"];
var light_color = {};
var color = {};
var dark_color = {};
groups.forEach(function(d,i){var c = d3.scale.category20c().range()[i];color[d] = c;light_color[d] = tinycolor(c).lighten();dark_color[d] = tinycolor(c).darken(7);});

var x = d3.scale.ordinal().rangeBands([margin,width - margin]);

var svg, canvas, orders, graph, options;


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

sapdash.init = function(data,opts){
    options = opts || {};
    options.display_links = options.display_links  || true;
    
    // Prepare Data
    graph = _process_data(data);

    // Preprocess xaxis positions
    orders = _get_orders(graph);

    // Set domain
    x.domain(orders.name);

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
        .attr("fill","black");

    // attach an axis for the nodes to sit on
    svg.append("line")          
        .style("stroke", "black")  
        .attr("stroke-width", 0.25)  
        .attr("x1", 0)     
        .attr("y1", yfixed)      
        .attr("x2", width)     
        .attr("y2", yfixed); 

    // create plot area within svg image
    var plot = svg.append("g")
                .attr("id", "plot")
            .append("g")
                .attr('id', "nodes");

    // draw links 
    if(options.display_links) drawLinks(graph.links);

    // draw nodes 
    drawNodes(graph.nodes);

    // Grab mynodes for zoom
    var myNodes = svg.selectAll(".node");

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


};

// /* MAIN DRAW METHOD */

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
        .style("fill",   function(d) { return color[d.group]; })
        .style("stroke", function(d) { return dark_color[d.group]; })
        .attr("cx", function(d) { return x(d.id);})
        .attr("cy", yfixed )
        .attr("r",  function(d,i) { return 10;})
        .on("mouseover", function(d) { 
            var sel = d3.select(this);
            sel.style("stroke","grey");
            addTooltip(sel);
        })
        .on("mouseout",  function(d, i) { 
            d3.select(this).style("stroke", function(d) { return dark_color[d.group];});
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

function _draw_arc(x1,x2,color){
     canvas.beginPath();
     var rel_dist = Math.abs(x1 - x2) / width; 
     var ycontrol = yfixed * (1 - rel_dist);
     var center = (x1 + x2)/2;
     canvas.moveTo(x1,yfixed);
     canvas.quadraticCurveTo(center, ycontrol, x2, yfixed);
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

//-----------------Public methods------------------

sapdash.change_order = function(order){
    x.domain(orders[order]);
    canvas.save();
    canvas.clearRect(0, 0, width, height);
    var t = svg.transition().duration(1000);

    t.selectAll("circle")
        .delay(function(d,i){return i*0.5;})
        .attr("cx", function(d) { return x(d.id); })
        .each("end", function(d){
            if(options.show_links && d.parents){
                d.parents.forEach(function(c){
                    _draw_arc(x(d.id),x(c.id),light_color[c.group]);
                });
            }
    });   
};

sapdash.show_links = function(bool){
    options.display_links = bool;
    if(options.display_links){
        drawLinks(graph.links);
    }
    else{
        canvas.clearRect(0, 0, width, height);
    }
};

//-----------------Helper functions------------------
function _process_data(graph){
     // Filter links with null source/target
    graph.links = graph.links.filter(function(d){
        return (d.source in graph.nodes && d.target in graph.nodes);}
    );

    graph.links.forEach(function(d, i) {
        // Set target/source to point to objects
        d.source = graph.nodes[d.source];
        d.target = graph.nodes[d.target];
        // Count degree
        d.source.degree = ++d.source.degree || 0;
        d.target.degree = ++d.target.degree || 0;
        // Set up parent/child id array in each node
        d.source.children = d.source.children || [];
        d.target.parents = d.target.parents || [];
        d.source.children.push(d.target);
        d.target.parents.push(d.source);
    });
    return graph;
}

function _get_orders(graph){
    return {
        name:   Object.keys(graph.nodes).sort(),
        group:  Object.keys(graph.nodes).sort(function(a, b) { return graph.nodes[b].group - graph.nodes[a].group;}),
        degree: Object.keys(graph.nodes).sort(function(a, b) { return graph.nodes[b].degree - graph.nodes[a].degree;} ),
    };
}

})();