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
var ids_by_group = {};

var color = {};
var dark_color = {};

var x = d3.scale.ordinal().rangeBands([margin,width - margin]);
var value = function(d){return default_radius;};
var svg, canvas, positions, options;
var nodes;

var focalNode, focalSet;

sapdash.init = function(data,opts,container_id){
    options = opts || {};
    options.show_links = options.show_links  || true;
    options.sort = options.sort  || "name";

    width = d3.select(container_id).node().getBoundingClientRect().width - 1;
    height = width * 0.2;

    nodes = data;

        
    // Set colors
    options.groups.forEach(function(d,i){
        var c = d3.scale.category20().range()[i];
        color[d] = c;
        dark_color[d] = tinycolor(c).darken(10).toString(); 
    });
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

    // draw nodes 
    drawNodes();

    // Set up zoom

    // Grab selection outside of zoom loop
    var zoom = d3.behavior.zoom().scaleExtent([1, 5000]).on("zoom", zoomed);
    svg.call(zoom);
    function zoomed(){    
        var myNodes = svg.selectAll(".node");
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
            myNodes.attr("cx", function(d) { return x(d.id);}).each(drawLinksToChildren);
            canvas.restore();       
        }
        else{
            myNodes.attr("cx", function(d) { return x(d.id);});
        }

        d3.selectAll(".highlight, .focal_highlight")
            .attr("d", getBezierSvg);
        
        d3.selectAll(".arctooltip, .arcfocaltip")
            .each(function(){
                d3.select(this).attr("x",x(this.textContent));
            });
    }
};

//-----------------Draw methods------------------

// Draws nodes on plot
function drawNodes() {

    // Preprocess xaxis positions
    positions = setPositions();
    // positions = setPositions(nodes);
    canvas.save();
    canvas.clearRect(0, 0, width, height);
            
    canvas.restore();  

    // Set domain
    x.domain(positions[options.sort]);

    // used to assign nodes color by group
    var circles =  d3.select("#nodes").selectAll(".node")
        .data( d3.values(nodes), function(d) {return d.id;});
    circles.enter()
        .append("circle")
        .attr("class", function(d){return "node";})
        .attr("id", function(d) { return d.id; })
        .style("fill",   function(d) { return color[d.group]; })
        .style("stroke", function(d) { return dark_color[d.group]; })
        // .attr("default-opacity",1)
        .attr("cx", function(d) { return x(d.id);})
        .attr("cy", yfixed )
        .attr("r",  0)
        .each(drawLinksToChildren)
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
                d3.selectAll(".highlight").remove();
                d3.selectAll(getFamilyString(d)).each(unhighlightNode);                
            }
            })
        .on("click", handleClick)
        .on("click.external", options.clickHandler);
    circles.transition()
        .duration(1000)
        .attr("cx", function(d) { return x(d.id);})
        .attr("r", value)
        .each(drawLinksToChildren);
    circles.exit().transition().duration(1000).attr("r",0).remove();
    }

function drawLinksToChildren(d) {
    if(options.show_links){
        d.children.forEach(function(c){
            if(c.id in nodes && viewable(d.id) || viewable(c.id)){
                drawArc(x(d.id),x(c.id),color[d.group]);
            }
        });
        
    }
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
    var sel = d3.select(".node#" + d.id);
    var r = +sel.attr("r") + 2.5;
    sel.style("stroke","yellow");
    sel.style("opacity",1);
    sel.style("stroke-width",1.5);
    sel.style("fill", function(d){return dark_color[d.group];});
    sel.attr("r",function(d){return value(d)+3;});
}

// unhighlight node
function unhighlightNode(d){
    var sel = d3.select(".node#" + d.id);
    if(!d3.select(this).attr("active")){
        var r = value(d);
        sel.style("stroke-width",1);
        sel.style("stroke", function(d) { return dark_color[d.group];});
        sel.style("fill", function(d){return color[d.group];});
        sel.attr("r",r);

        //If focalNode is set subgraph is active and default opacity is 0.05 
        if(focalNode) sel.style("opacity",0.05);
        else sel.style("opacity",1);   
    }
}

function handleClick(d){
    
    if(d === focalNode || typeof d === "undefined" || d === ""){
        d3.selectAll(".node")
            .style("opacity",1)
            .style("stroke", function(d) { return dark_color[d.group]; })
            .attr("active",null)
            .attr("r",  value );

        d3.select("#mask").style("fill-opacity",0);
        d3.selectAll(".arcfocaltip").remove(); 
        d3.selectAll(".focal_highlight").remove();
        focalNode = null;
        focalSet = null;
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
        d3.selectAll(".arctooltip, .arcfocaltip").remove(); 
        addTooltip(d);
        d3.selectAll(".nodename")
            .attr("class","arcfocaltip")
            .attr("dy", margin*2);
    }
}

function showSubgraph(nodes,links){
    d3.selectAll(".node")
        .each(function(d){
            var sel = d3.select(this);
            if(nodes.indexOf(d) === -1){
                sel.style("opacity",0.05);
                sel.attr("active",null);
                var r = value(d);
                sel.style("stroke-width",1);
                sel.style("stroke", function(d) { return dark_color[d.group];});
                sel.style("fill", function(d){return color[d.group];});
                sel.attr("r",r);
            }
            else{
                sel.attr("active","active");
                sel.style("opacity",1);
                highlightNode(d);
            }
        });
    d3.selectAll(".focal_highlight").remove();
    highlightPath(links);
    d3.selectAll(".highlight").attr("class","focal_highlight");
}

//-----------------End draw methods------------------


//-----------------Public methods------------------

sapdash.sort_by = function(order){
    x.domain(positions[order]);
    canvas.save();
    canvas.clearRect(0, 0, width, height);
    d3.select("#mask").style("fill-opacity",1);
    var t = svg.transition().duration(1500);

    if(options.show_links){
        if(focalNode){
            t.select("#mask").style("fill-opacity",0.55);   
        }
        else{
            t.select("#mask").style("fill-opacity",0);   
        }
        canvas.save();
        canvas.clearRect(0, 0, width, height);
        t.selectAll("circle")
            .attr("cx", function(d) { return x(d.id); })
            .each(drawLinksToChildren);
        canvas.restore();  
    }
    else{
        t.selectAll("circle")
            .attr("cx", function(d) { return x(d.id); });
    }

    t.selectAll(".highlight,.focal_highlight")
        .attr("d", getBezierSvg);
    t.selectAll(".arctooltip,.arcfocaltip")
            .each(function(){
                d3.select(this).attr("x",x(this.textContent));
            });         
};

sapdash.show_links = function(bool){
    options.show_links = bool;
    if(options.show_links){
        canvas.save();
        canvas.clearRect(0, 0, width, height);
        for (var key in nodes) {
            drawLinksToChildren(nodes[key]);
        }
        canvas.restore();  
    }
    else{
        canvas.clearRect(0, 0, width, height);
    }
};

sapdash.set_value = function(new_value){
    if(new_value === "none") value = function(d){return default_radius;};
    else{
        value = function(d){
            if(d[new_value] && d[new_value] <= 1){
                // Grow up to 3 times as big as default
                return d[new_value] * 2 * default_radius;
            }
            // Scale logarithmically with 2px minimum   
            else if( d[new_value] && d[new_value] > 1) {
                return Math.max(2,Math.log(d[new_value]));
            }
            else return default_radius;
        };
    }
    positions = setPositions();

    var t = svg.transition().duration(500);
    t.selectAll("circle")
        .attr("r", value);
};

sapdash.update_nodes = function(data,groups,sort){
    nodes = data;
    options.groups = groups;
    options.sort = sort;
    drawNodes(nodes);
    t = svg.transition().duration(1000);
    t.selectAll(".highlight,.focal_highlight")
            .attr("d", getBezierSvg);
};

sapdash.selectNode = function(id){
    handleClick(nodes[id]);
    
};

sapdash.get_focal_set = function(){
    return focalSet;
};


sapdash.visibleNodes = function(){
    return nodes;
};

//-----------------End public methods------------------

//-----------------Helper functions------------------

function setPositions(order){
    // Helper sort functions
    function get_sorter(sortby){
        if(sortby === "startdate"){
            return function(a,b) {return new Date(nodes[b][sortby]) - new Set(nodes[a][sortby]);};
        }
        return function(a, b) { return nodes[b][sortby] - nodes[a][sortby];};
    }

    var ids_by_group = {};
    for(var key in nodes) {
        if(ids_by_group[nodes[key].group]) ids_by_group[nodes[key].group].push(key);
        else{
            ids_by_group[nodes[key].group] = [key];
        }
    }
   
    var finalPosition = {name:[], degree:[], performance:[], usage:[], startdate:[], loc:[],};

    var ordering = options.groups;

    ordering.forEach(function(group) {
        var spacer = d3.range(5).map(function(d){return group+d;});
        if(ids_by_group[group]){
            finalPosition.name        = finalPosition.name.concat(ids_by_group[group].sort()).concat(spacer);
            finalPosition.degree      = finalPosition.degree.concat(ids_by_group[group].sort(get_sorter("degree"))).concat(spacer);
            finalPosition.performance = finalPosition.performance.concat(ids_by_group[group].sort(get_sorter("performance"))).concat(spacer);
            finalPosition.usage       = finalPosition.usage.concat(ids_by_group[group].sort(get_sorter("usage"))).concat(spacer);
            finalPosition.startdate   = finalPosition.startdate.concat(ids_by_group[group].sort(get_sorter("startdate"))).concat(spacer);
            finalPosition.loc         = finalPosition.loc.concat(ids_by_group[group].sort(get_sorter("loc"))).concat(spacer);
        }
    });

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

    if(x1 && x2){
        if(x1 > width || x1 < 0) x1 = [x2, x2 = x1][0]; //Swap if x1 not in viewport
        
        rel_dist = Math.abs(x1 - x2) / width; 
        ycontrol = yfixed * (1 - 2*rel_dist);
        center = (x1 + x2)/2;
        return "M" + x1 + " " + yfixed + " Q " + center + " " + ycontrol + ", " + x2 + " " + yfixed;
    }
    // Want x1 to be within viewport (bug if pen is moved too far out of view)
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
        .attr("dy", margin*2.5)
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
            if(d.id in nodes) l.push({source:d,target:node});
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
            if(c.id in nodes) l.push({source:node,target:c});
        });
    }
    return l;
}


function getAllParentsAndChildren(d){
    var fam = [d];

    function getAllParentsRecursive(caller){
        var parents = caller.parents;
        parents.forEach(function(p) {
            if(!_.contains(fam,p) && p.id in nodes){
                p.child = caller;
                fam.push(p);
                getAllParentsRecursive(p);
            }
        });
    }
    function getAllChildrenRecursive(caller){
        var children = caller.children;
        children.forEach(function(c) {
            if(!_.contains(fam,c) && c.id in nodes){
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