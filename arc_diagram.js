(function() {
// SAP Dashboard object
sapdash = {};

/* GLOBALS */

var width  = 1250;             // width of svg image
var height = 250;             // height of svg image
var margin = 20;              // amount of margin around plot area
var yoffset = 30;             // Offset from bottom
var yfixed = height - margin  - yoffset;  // y position for all nodes
var default_radius = 12;

// Get colours
// var groups = ["PROG","TCOD","VIEW","FUNC","TABL","INCL","METH","FUGR","TTAB","STRU","DTEL","TTYP"];
var groups = [];
var idsByGroup = {};

var color = {};
var dark_color = {};


var x = d3.scale.ordinal().rangeBands([margin,width - margin]);
var value = function(d){return default_radius;};
var svg, canvas, orders, graph, options;

var focalNode;

sapdash.init = function(data,opts,container_id){
    options = opts || {};
    options.show_links = options.show_links  || true;
    width = d3.select(container_id).node().getBoundingClientRect().width - 1;
    height = width * 0.2;

    
    // Prepare Data
    graph = processData(data);

    // Set colors
    groups = Object.keys(idsByGroup);
    groups.forEach(function(d,i){
        var c = d3.scale.category20().range()[i];
        color[d] = c;
        dark_color[d] = tinycolor(c).darken(10); 
    }
    );

    // Preprocess xaxis positions
    orders = getOrders(graph);

    // Set domain
    x.domain(orders.name);

    canvas = d3.select(container_id)
        .append("canvas")
        .attr("id","background")
        .attr("width",width)
        .attr("height",height)
        .node().getContext("2d");
    
    canvas.globalAlpha=0.5;

    // create svg image
    svg = d3.select(container_id)
        .append("svg")
        .attr("id", "arc")
        .attr("class","svg")
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
            .style("fill-opacity",0)
            .attr("fill","#F0F0F0");
    
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
        d3.selectAll(".highlight,.focal_highlight")
            .attr("d", getBezierSvg);
        
        d3.selectAll(".tooltip, .focaltip")
            .each(function(){
                d3.select(this).attr("x",x(this.textContent));
            });
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
        .attr("default-opacity",1)
        .attr("cx", function(d) { return x(d.id);})
        .attr("cy", yfixed )
        .attr("r",  value )
        .on("mouseover", function(d){
           if(d != focalNode){
                addTooltip(d);
                highlightNode(d);
            }
        })
        .on("mouseover.highlightPath", function(d){
           if(d != focalNode){
               var pathdata = makeParentLinks(d).concat(makeChildLinks(d));
               highlightPath(pathdata);
            }
        }) 
        .on("mouseover.highlightFamily", function(d){
            if(d != focalNode){
                d3.selectAll(getFamilyString(d)).each(highlightNode);
            }
        }) 
        .on("mouseout",  function(d) { 
           if(d != focalNode){
                d3.selectAll(".nodename").remove(); 
                unhighlightNode(d);
                d3.selectAll(".highlight").remove();
                d3.selectAll(getFamilyString(d)).each(unhighlightNode);                
            }
            })
        .on("click", handleClick);

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
    sel.style("opacity",1);
    sel.style("stroke-width",1.5);
    sel.style("fill", function(d){return dark_color[d.group];});
    sel.attr("r",function(d){return value(d)+3;});
}

// unhighlight node
function unhighlightNode(d){
    var sel = d3.select("#" + d.id);
    var r = value(d);
    var op = +sel.attr("default-opacity");
    sel.style("stroke-width",1);
    sel.style("stroke", function(d) { return dark_color[d.group];});
    sel.style("fill", function(d){return color[d.group];});
    sel.attr("r",r);
    sel.style("opacity",op);

}

function handleClick(d){
    if(d === focalNode){
        d3.selectAll(".node")
            .style("opacity",1)
            .style("stroke", function(d) { return dark_color[d.group]; })
            .attr("r",  value )
            .attr("default-opacity",1);

        d3.select("#mask").style("fill-opacity",0);
        d3.selectAll(".focaltip").remove(); 
        d3.selectAll(".focal_highlight").remove();
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
        d3.select("#mask").style("fill-opacity",0.55);

        showSubgraph(focalSet,links);
        focalNode = d;

        // Change tooltip
        d3.selectAll(".tooltip, .focaltip").remove(); 
        addTooltip(d);
        d3.selectAll(".nodename")
            .attr("class","focaltip")
            .attr("dy", margin*1.5);

    }
}

function showSubgraph(nodes,links){
    d3.selectAll(".node")
        .each(function(d){
            var sel = d3.select(this);
            if(nodes.indexOf(d) === -1){
                sel.style("opacity",0.05);
                sel.attr("default-opacity",0.05);
                var r = value(d);
                sel.style("stroke-width",1);
                sel.style("stroke", function(d) { return dark_color[d.group];});
                sel.style("fill", function(d){return color[d.group];});
                sel.attr("r",r);
            }
            else{
                sel.style("opacity",1);
                sel.attr("default-opacity",1);
                highlightNode(d);
            }
        });
    d3.selectAll(".focal_highlight").remove();
    highlightPath(links);
    d3.selectAll(".highlight").attr("class","focal_highlight");
}

//-----------------End draw methods------------------


//-----------------Public methods------------------

sapdash.change_order = function(order){
    x.domain(orders[order]);
    canvas.save();
    canvas.clearRect(0, 0, width, height);
    d3.select("#mask").style("fill-opacity",1);
    var t = svg.transition().duration(1500);
    t.selectAll("circle")
        .attr("cx", function(d) { return x(d.id); });
    t.selectAll(".highlight,.focal_highlight")
        .attr("d", getBezierSvg);
    t.selectAll(".tooltip,.focaltip")
            .each(function(){
                d3.select(this).attr("x",x(this.textContent));
            }); 
    if(options.show_links){

        if(focalNode){
            t.select("#mask").style("fill-opacity",0.55);   
        }
        else{
            t.select("#mask").style("fill-opacity",0);   
        }
        canvas.save();
        canvas.clearRect(0, 0, width, height);
        drawLinks(graph.links);
        canvas.restore();    
    }            
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
    // Recalculate values (This should be refactored)
    orders.value = [];
    var mapCallback = function(d){return group+d;};
    var valueSort =  function(a, b) { return value(graph.nodes[b]) - value(graph.nodes[a]);};

    for (var group in idsByGroup) {
        var spacer = d3.range(5).map(mapCallback);
        orders.value  = orders.value.concat(idsByGroup[group].sort(valueSort)).concat(spacer);
    }

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

        // load idsByGroup global
        if(idsByGroup[graph.nodes[key].group]) idsByGroup[graph.nodes[key].group].push(key);
        else{
            idsByGroup[graph.nodes[key].group] = [key];
        }
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
    // Helper sort functions
    var degreeSort = function(a, b) { return graph.nodes[b].degree - graph.nodes[a].degree;};
    var valueSort =  function(a, b) { return value(graph.nodes[b]) - value(graph.nodes[a]);};
    var mapCallback = function(d){return group+d;};
   
    var finalPosition = {name:[], degree:[], value:[]};

    // Used for spacing

    for (var group in idsByGroup) {
        var spacer = d3.range(5).map(mapCallback);
        finalPosition.name   = finalPosition.name.concat(idsByGroup[group].sort()).concat(spacer);
        finalPosition.degree = finalPosition.degree.concat(idsByGroup[group].sort(degreeSort)).concat(spacer);
        finalPosition.value  = finalPosition.value.concat(idsByGroup[group].sort(valueSort)).concat(spacer);
    }

    return finalPosition;
}


function drawArc(x1,x2,color){
     canvas.beginPath();
     var rel_dist = Math.abs(x1 - x2) / width; 
     var ycontrol = yfixed * (1 - 2*rel_dist);
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
    ycontrol = yfixed * (1 - 2*rel_dist);
    center = (x1 + x2)/2;
    return "M" + x1 + " " + yfixed + " Q " + center + " " + ycontrol + ", " + x2 + " " + yfixed;
}

// Generates a tooltip for a SVG circle element based on its ID
function addTooltip(d) {
    var xpos = x(d.id);
    var text = d.id;

    var tooltip = d3.select("#plot")
        .append("text")
        .text(text)
        .attr("x", xpos)
        .attr("y", yfixed)
        .attr("dy", margin*2)
        .attr("class", "nodename");

    var offset = tooltip.node().getBBox().width / 2;

    if ((xpos - offset) < 0) {
        tooltip.attr("text-anchor", "start");}
    else if ((xpos + offset) > (width - margin)) {
        tooltip.attr("text-anchor", "end");}
    else {
        tooltip.attr("text-anchor", "middle");
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