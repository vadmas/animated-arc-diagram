// Data in format {nodes:[],edges:[]}
var DataHandler = function(data){
	 var groups = [];
	 var nodes = data.nodes;
	 var links = data.links;

  	 for(var key in nodes) {
        var node = nodes[key];
            node.degree   = 0;
            node.parents  = [];
            node.children = [];
            node.parent_ids  = [];
            node.children_ids = [];
        if(!_.contains(groups,nodes[key].group)){
            groups.push(nodes[key].group);
        }
    }
     // Filter links with null source/target
    links = links.filter(function(d){
        return (d.source in nodes && d.target in nodes);}
    );

    links.forEach(function(d, i) {
        // Set target/source to point to objects
        d.source = nodes[d.source];
        d.target = nodes[d.target];
        // Count degree
        d.source.degree++;
        d.target.degree++;
        // Set up parent/child id array in each node
        d.source.children.push(d.target);
        d.target.parents.push(d.source);

        // For datatable
        d.source.children_ids.push(d.target.id);
        d.target.parent_ids.push(d.source.id);
    });

	function publicMethod(){
		console.log("Public");
	}
    
    function getByGroup(groups){
        if(typeof groups === 'string') groups = [groups];
        var validNodes = {};
        for (var n in nodes) {
            if (_.contains(groups,nodes[n].group)){
                validNodes[n] = nodes[n];
            }
        }
        return validNodes;
    }
	
    // REFACTOR HERE
    function filterBy(performanceRange,usageRange,groups){
        var validNodes = {};
        for (var n in nodes) {
            if (_.contains(groups,nodes[n].group) && nodes[n].performance < performanceRange[1]  && nodes[n].performance > performanceRange[0]  && nodes[n].usage < usageRange[1] && nodes[n].usage > usageRange[0]){
                validNodes[n] = nodes[n];
            }
        }
        return validNodes;
    }

    function getAsArray(){
        var validNodes = [];
        for (var n in nodes) {
            validNodes.push(nodes[n]);
        }
        return validNodes;
    }

	function getNode(id){
		return nodes[id];
	}

	return {
		nodes: nodes,
		groups: groups,
		publicMethod: publicMethod,
        getByGroup: getByGroup,
        filterBy: filterBy,
        getAsArray: getAsArray,
		getNode: getNode,
	};
};