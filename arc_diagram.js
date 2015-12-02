(function() {
// SAP Dashboard object
sapdash = {};

/* GLOBALS */

var width  = 1200;             // width of svg image
var height = 400;             // height of svg image
var margin = 20;              // amount of margin around plot area
var yoffset = 30;             // Offset from bottom
var yfixed = height - margin  - yoffset;  // y position for all nodes
var default_radius = 12;

// Get colours
var groups = ["PROG","TCOD","VIEW","FUNC","TABL","INCL","METH","FUGR","TTAB","STRU","DTEL","TTYP"];
var color = {};
var dark_color = {};
var light_color = {};
groups.forEach(function(d,i){var c = d3.scale.category20().range()[i];color[d] = c;dark_color[d] = tinycolor(c).darken(10); light_color[d] = tinycolor(c).lighten(10);});

var x = d3.scale.ordinal().rangeBands([margin,width - margin]);
var value = function(d){return default_radius;};
var svg, canvas, orders, graph, options;

var focalNode;

sapdash.init = function(data,opts){
    options = opts || {};
    options.show_links = options.show_links  || true;
    
    // Prepare Data
    graph = processData(data);

    // Preprocess xaxis positions
    orders = getOrders(graph);

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
        .attr("height", height);

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
                .attr("id", "plot");

    var mask = svg.append("rect")
            .attr("id","mask")
            .attr("width", width)
            .attr("height", yfixed)
            .style("stroke","#888888")
            .style("stroke-width",1)
            .style("fill-opacity",0.45)
            .attr("fill","white");
    
    // highlight path layer
    svg.append("g")
        .attr("id","highlight-path-layer");

    // nodes layer        
    svg.append("g")
        .attr('id', "nodes");

    // draw links 
    if(options.show_links) drawLinks(graph.links);

    // draw nodes 
    drawNodes(graph.nodes);

    // Set up zoom

    // Grab selection outside of zoom loop
    var myNodes = svg.selectAll(".node");
    var zoom = d3.behavior.zoom().scaleExtent([1, 5000]).on("zoom", zoomed);
    svg.call(zoom);
    function zoomed(){    
        var s = zoom.scale();
        var t = zoom.translate()[0];
        
        var tx = Math.min(0, Math.max(width * (1 - s), t));
        zoom.translate([tx, 0]);

        var xmin = margin + tx;
        var xmax = tx + s*(width - margin);
        x.rangeBands([xmin,xmax]);
        if(options.show_links){
            canvas.save();
            canvas.clearRect(0, 0, width, height);
            drawLinks(graph.links);
            canvas.restore();       
        }
        myNodes.attr("cx", function(d) { return x(d.id);});
        d3.selectAll(".highlight")
            .attr("d", getBezierSvg);
    }
};

//-----------------Draw methods------------------

// Draws nodes on plot
function drawNodes(nodes) {
    // used to assign nodes color by group
    var circles =  d3.select("#nodes").selectAll(".node")
        .data( d3.values(nodes), function(d) {return d.id;});
    circles.enter()
        .append("circle")
        .attr("class", function(d){return "node";})
        .attr("id", function(d) { return d.id; })
        .style("fill",   function(d) { return color[d.group]; })
        .style("stroke", function(d) { return dark_color[d.group]; })
        .attr("cx", function(d) { return x(d.id);})
        .attr("cy", yfixed )
        .attr("r",  value )
        .on("mouseover", function(d){
            addTooltip(d3.select(this));
            
            if(!focalNode){
                highlightNode(d);
            }
        })
        .on("mouseover.highlightPath", function(d){
            if(!focalNode){
               var pathdata = makeParentLinks(d).concat(makeChildLinks(d));
               highlightPath(pathdata);
            }
        }) 
        .on("mouseover.highlightFamily", function(d){
            if(!focalNode){
                d3.selectAll(getFamilyString(d)).each(highlightNode);
            }
        }) 
        .on("mouseout",  function(d) { 
                d3.select("#tooltip").remove(); 
            if(!focalNode){
                unhighlightNode(d);
                d3.selectAll(".highlight").remove();
                d3.selectAll(getFamilyString(d)).each(unhighlightNode);                
            }
            })
        .on("click", showFamily);

    circles.exit().style("opacity",0.05);
    }

// Draws arcs for each link on plot
// *Note* draws on CANVAS not SVG for performance
function drawLinks(links) {
    links.forEach(function(d){
        if(viewable(d.source.id) || viewable(d.target.id)){
            drawArc(x(d.source.id),x(d.target.id),color[d.source.group]);
        }
    });
}

// Draw highlight arc on hover
function highlightPath(data){
    d3.selectAll(".highlight").remove();
    var path = d3.select("#highlight-path-layer").selectAll(".highlight")
        .data(data);
    path.enter()
        .append("path")
        .attr("class", "highlight")
        .style("stroke", function(d){return dark_color[d.source.group];})
        .style("stroke-width", 2)
        .style("fill",  "none")
        .attr("d", getBezierSvg);
    path.exit().remove();
}

// Highlight node
function highlightNode(d){
    var sel = d3.select("#" + d.id);
    var r = +sel.attr("r") + 2.5;
    sel.style("stroke","yellow");
    sel.style("stroke-width",1.5);
    sel.style("fill", function(d){return dark_color[d.group];});
    sel.attr("r",function(d){return value(d)+3;});
    
}

// unhighlight node
function unhighlightNode(d){
    var sel = d3.select("#" + d.id);
    var r = value(d);
    sel.style("stroke-width",1);
    sel.style("stroke", function(d) { return dark_color[d.group];});
    sel.style("fill", function(d){return color[d.group];});
    sel.attr("r",r);
}

function showFamily(d){
    if(d === focalNode){
        d3.selectAll(".node")
            .style("opacity",1)
            .style("stroke", function(d) { return dark_color[d.group]; })
            .attr("r",  value );
        focalNode = null;
    }
    else{
        focalSet = getAllParentsAndChildren(d);

        var links = [];
        focalSet.forEach(function(f) {
            if(f.child){
                links.push({source:f,target:f.child});
            }
            else if(f.parent){
                links.push({source:f.parent,target:f});
            }
        });
        showSubgraph(focalSet,links);
        focalNode = d;
    }
}

function showSubgraph(nodes,links){
    d3.selectAll(".node")
        .each(function(d){
            var sel = d3.select(this);
            if(nodes.indexOf(d) === -1){
                sel.style("opacity",0.05);
                var r = value(d);
                sel.style("stroke-width",1);
                sel.style("stroke", function(d) { return dark_color[d.group];});
                sel.style("fill", function(d){return color[d.group];});
                sel.attr("r",r);
            }
            else{
                sel.style("opacity",1);
                highlightNode(d);
            }
        });
    highlightPath(links);
}

//-----------------End draw methods------------------


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
                    drawArc(x(d.id),x(c.id),color[c.group]);
                });
            }
        });   
};

sapdash.show_links = function(bool){
    options.show_links = bool;
    if(options.show_links){
        drawLinks(graph.links);
    }
    else{
        canvas.clearRect(0, 0, width, height);
    }
};

sapdash.set_value = function(new_value){
    if(new_value === "none") value = function(d){return default_radius;};
    else{
        value = function(d){
            if(d[new_value]) return Math.max(2,Math.log(d[new_value]));
            else return default_radius;
        };
    }
    orders.value = Object.keys(graph.nodes).sort(function(a, b) { 
        return value(graph.nodes[b]) - value(graph.nodes[a]);
    });
    var t = svg.transition().duration(500);
    t.selectAll("circle")
        .attr("r", value);
};


//-----------------End public methods------------------

//-----------------Helper functions------------------
function processData(graph){
    for(var key in graph.nodes) {
        var node = graph.nodes[key];
            node.degree   = 0;
            node.parents  = [];
            node.children = [];
    }
     // Filter links with null source/target
    graph.links = graph.links.filter(function(d){
        return (d.source in graph.nodes && d.target in graph.nodes);}
    );

    graph.links.forEach(function(d, i) {
        // Set target/source to point to objects
        d.source = graph.nodes[d.source];
        d.target = graph.nodes[d.target];
        // Count degree
        d.source.degree++;
        d.target.degree++;
        // Set up parent/child id array in each node
        d.source.children.push(d.target);
        d.target.parents.push(d.source);
    });
    return graph;
}

function getOrders(graph){
    return {
        name:   Object.keys(graph.nodes).sort(),
        group:  Object.keys(graph.nodes).sort(function(a, b) { return graph.nodes[a].group.localeCompare(graph.nodes[b].group);}),
        degree: Object.keys(graph.nodes).sort(function(a, b) { return graph.nodes[b].degree - graph.nodes[a].degree;}),
        value:  Object.keys(graph.nodes).sort(function(a, b) { return value(graph.nodes[b]) - value(graph.nodes[a]);})
    };
}


function drawArc(x1,x2,color){
     canvas.beginPath();
     var rel_dist = Math.abs(x1 - x2) / width; 
     var ycontrol = yfixed * (1 - rel_dist);
     var center = (x1 + x2)/2;
     canvas.moveTo(x1,yfixed);
     canvas.quadraticCurveTo(center, ycontrol, x2, yfixed);
     canvas.strokeStyle = color;
     canvas.stroke();
}

function getBezierSvg(d){
    var x1, x2, rel_dist, ycontrol, center;
    x1 = x(d.source.id);
    x2 = x(d.target.id);

    // Want x1 to be within viewport (bug if pen is moved too far out of view)
    if(x1 > width || x1 < 0) x1 = [x2, x2 = x1][0]; //Swap if x1 not in viewport
    
    rel_dist = Math.abs(x1 - x2) / width; 
    ycontrol = yfixed * (1 - rel_dist);
    center = (x1 + x2)/2;
    return "M" + x1 + " " + yfixed + " Q " + center + " " + ycontrol + ", " + x2 + " " + yfixed;
}

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

function viewable(d){
    return (x(d) > -width && x(d) < width*2); 
}

function reset_color(){
     d3.selectAll("circle")
        .transition()
        .duration(200)
        .style("fill",function(d) {return color[d.group];});    
}


function makeParentLinks(node){
    var l = [];
    if(node.parents){
        node.parents.forEach(function(d){
            l.push({source:d,target:node});
        });
    }
    return l;
}

function getFamilyString(node){
    var l = ["#"+node.id];
    if(node.parents){
        node.parents.forEach(function(d){
            l.push("#"+d.id);
        });
    }
    if(node.children){
        node.children.forEach(function(d){
            l.push("#"+d.id);
        });
    }
    return l.toString();
}

// function getSelectorStringFromArray(arr){
//     var l = [];
//     arr.forEach(function(elem) {
//          l.push("#"+elem.id);
//      }); 
//     return l.toString();
// }

function makeChildLinks(node){
    var l = [];
    if(node.children){
        node.children.forEach(function(c){
            l.push({source:node,target:c});
        });
    }
    return l;
}


function getAllParentsAndChildren(d){
    var fam = [d];

    function getAllParentsRecursive(caller){
        var parents = caller.parents;
        parents.forEach(function(p) {
            if(!_.contains(fam,p)){
                p.child = caller;
                fam.push(p);
                getAllParentsRecursive(p);
            }
        });
    }
    function getAllChildrenRecursive(caller){
        var children = caller.children;
        children.forEach(function(c) {
            if(!_.contains(fam,c)){
                c.parent = caller;
                fam.push(c);
                getAllChildrenRecursive(c);
            }
        });
    }

    getAllParentsRecursive(d);
    getAllChildrenRecursive(d);

    return fam;
}



//-----------------End helper methods------------------
})();