// --- Util ---
function makeEditButton(onclick) {
  return $('<div class="edit_button tb_button">Edit</div>').on('click', onclick);
}
function makeURL(path) {
  return '/' + path;
  return 'https://bhasa.herokuapp.com/' + path;
}
function runJSON(method, path, query, callback) {
  console.log(query);
  
  var settings = {
    'method': method,
    'url': makeURL(path),
    'data': query,
    // 'dataType': 'json',
    'complete': callback,
  };
  
  if (method !== 'GET' && method !== 'HEAD')
    settings.contentType = 'application/json';
  
  $.ajax(settings);
}
function divWithClass(cl) {
  var div = $("<div>");
  if (cl !== null)
    div.addClass(cl);
  return div;
}
function tagWithClass(name, cl) {
  var el = $("<" + name + ">");
  if (cl !== null)
    el.addClass(cl);
  return el;
}
function codeMirrorGoEnd(cm) {
  cm.execCommand("goDocEnd"); // try once
  setTimeout(function() { cm.execCommand("goDocEnd"); }, 1); // try again
}
function makeCodeMirror(el, mode, txt) {
  console.log(el.get(0));
  var cm = CodeMirror(el[0], {
    viewportMargin: Infinity,
    mode: mode,
    tabSize: 2,
    // lineNumbers: true,
    autofocus: true,
    lineWrapping: true,
    theme: 'cmtn',
    value: txt,
  });
  codeMirrorGoEnd(cm);

  return cm;
}


// --- Rendering ---
function _renderSearchResult(r) {
  var result = divWithClass("pl_item");
  result.addClass('noselect');
  result.text(r.title);
  return result;
}
function _renderSearchForm() {
  var search = $('<input class="searchfield" type="search" placeholder="search e.g. map()">');
  
  var search_results = $('<div id="search_results">');
  search_results.addClass("pl_list")
  search_results.append(_renderSearchResult({ title: "Hello" }));
  search_results.append(_renderSearchResult({ title: "Hello" }));
  
  var doSearch = _.debounce(function() {
    var query = search.val();
    runJSON('GET', 'api/search', { 'q': query }, function(data) {
      console.log(data);
      data = data.responseJSON;
      console.log(data);
      
      var rs = data.results;
      var els = [];
      rs.forEach(function(r) {
        els.push(_renderSearchResult(r));
      });
      
      search_results.empty();
      search_results.append(els);
      
    }, 'json');
  }, 500);
  
  search.on('input', function() {
    doSearch();
  });
  
  return [search, search_results];
}
function renderHome() {
  var content = divWithClass("home");
  
  var tagline = tagWithClass("p", "tagline");
  tagline.html("<b>bhasa</b> is the programming language that anyone can edit.");
  content.append(tagline);
  
  content.append(_renderSearchForm());
  return content;
}
function renderSearch() {
  var content = divWithClass("search");
  
  content.append(_renderSearchForm());
  return content;
}
function keyOrderForArticle(art) {
  function mergeOrder(list, set, keyOrder) {
    keyOrder.forEach(function(k) {
      if (set.has(k))
        return;
      list.push(k);
      set.add(k);
    });
  }
  
  var tradOrder = [];
  var order = art.order;
  if (!order) order = [];
  
  var orderSet = new Set(order);
  mergeOrder(order, orderSet, tradOrder);
  
  var alphaKeys = _.keys(art);
  alphaKeys.sort();
  mergeOrder(order, orderSet, alphaKeys);
  
  return order;
}


function renderArticle(art) {
  var content = tagWithClass('article');
  var ignoredKeys = new Set(['title']);
  
  var order = keyOrderForArticle(art);
  
  var editMap = [];
  
  var sharedCommit = {
    art: art,
    callback: (function() {
      $(this).hide();
      
      var art = window.ARTICLE;
      
      // Modify
      editMap.forEach(function(mapping) {
        mapping();
      });
      
      console.log(JSON.stringify(art, null, 4));
      
      runJSON('POST', 'api/item', JSON.stringify(art), function(resp) {
        var status = resp.status;
        var content;
        if (status === 200) {
          location.reload(true);
        }
        else {
          debugger;
          alert("Error");
        }
      });
      
    }),
  };
  var commitButton = $('<div id="commit_button" class="tb_button">Commit</div>');
  commitButton.hide();
  commitButton.on('click', function() {
    sharedCommit.callback.bind(this)();
  });
  
  // Heading
  var h1 = $('<h1 contenteditable="false" id="title"></h1>');
  h1.text(art.title);
  h1.append(commitButton);
  content.append(h1);
  
  
  marked.setOptions({
    renderer: new marked.Renderer(),
    gfm: true,
    tables: true,
    breaks: false,
    pedantic: false,
    sanitize: true,
    smartLists: true,
    smartypants: false,
  });
  
  order.forEach(function(k) {
    if (ignoredKeys.has(k)) return;
    
    var value = art[k];
    if (value == null) return;
    
    var section = tagWithClass('section');
    
    if (_.isObject(value)) {
      var kind = value.kind;
      
      // This shared object exposes a callback that can be set below
      var shared = {
        modeString: 'read',
        callback: function() { } };
      
      if (value.hasOwnProperty('title')) {
        var h2 = $('<h1 contenteditable="false" id="title"></h1>');
        h2.text(value.title);
        h2.append(makeEditButton(function(editButton) {
          console.log(shared.modeString);
          if (shared.modeString === 'read')
            shared.modeString = 'edit';
          else if (shared.modeString === 'edit')
            shared.modeString = 'commit';
          shared.editButton = $(this);
          shared.callback();
        }));
        section.append(h2);
      }
      
      if (value.hasOwnProperty('val')) {
        var innerVal = value.val;
        if (_.isString(innerVal)) {
          /*editMap.push((function() {
            return function(_art) {
              value.val = 
            };
          })())*/
          
          
          var stuff = divWithClass('paras');
          var cm_mode = 'plain';
          if (kind === 'md') {
            // Markdown
            stuff.html(marked(innerVal));
            cm_mode = 'markdown';
          }
          else if (kind === 'txt') {
            // Plain text
            stuff.text(innerVal);;
          }
          else {
            // Something else
            cm_mode = 'javascript';
            stuff = tagWithClass('pre');
            stuff.addClass('padded');
            stuff.addClass('cm-s-cmtn');
            CodeMirror.runMode(innerVal, cm_mode, stuff[0]);
          }
          section.append(stuff);
          
          var editor = divWithClass('editor');
          editor.hide();
          var cm = makeCodeMirror(editor, cm_mode, '');
          section.append(editor);
          
          shared.value = innerVal;
          shared.callback = function() {
            
            if (shared.modeString === 'edit') {
              // Edit mode
              stuff.hide();
              editor.show();
              cm.setValue(shared.value);
              codeMirrorGoEnd(cm);
              cm.focus();
              
              shared.editButton.text('Commit');
              shared.editButton.removeClass('edit_button').addClass('important_button')
              
              shared.editButton.hide();
              commitButton.show();
              
              editMap.push(function() {
                value.val = cm.getValue();
              });
            }
          };
        }
      }
    }
    
    content.append(section);
  });
  
  return content;
}
function renderFunction() {
  var art = tagWithClass('article', 'func');
  return art;
}
function renderArticle404(path) {
  return renderNewPage(path);
  return renderArticle({
    title: 'Uh oh',
    order: ["foo", "baz", "bar"],
    foo: { title: "Foo", val: "*Hello*", kind: "md" },
    bar: { title: "Foo", val: "*Hello*", kind: "txt" },
    baz: { title: "Foo", val: "function foo()", kind: "js" },
  });
  
  var content = divWithClass('article404');
  content.text("Page not found");
  return content;
}
function renderNewPage(path) {
  var content = divWithClass('new_page');
  
  var titleInput = $("<input name='title' type='text'>");
  content.append(titleInput);
  
  function _makeTSelectInput(name) {
    return $("<option>").text(name);
  }
  
  var templateSelect = $("<select name='template'>");
  templateSelect.append([
    _makeTSelectInput("Article"),
    _makeTSelectInput("Function"),
  ])
  content.append(templateSelect);
  
  var editorToolbar = $('<div id="editor_toolbar">');
  var createButton = $('<div id="edit_button" class="tb_button"></div>');
  createButton.text("Create");
  editorToolbar.append(createButton);
  content.append(editorToolbar);

  createButton.on('click', function() {
    
    var art = {
        title: path,
        order: ["description", "impl", "tests"],
        description: { title: "About", val: "*This is a new page, add some content*", kind: "md" },
        // ccc: { title: "CCC", val: "*Hello*", kind: "txt" },
        impl: { title: "Implementation", val: "function foo() {\n}\n", kind: "js" },
        tests: { title: "Implementation", val: "function test1() {\n}\n", kind: "js" },
    };
    runJSON('POST', 'api/create-from-template', JSON.stringify(art), function(resp) {
      var status = resp.status;
      var content;
      if (status === 200) {
        location.reload(true);
      }
      else {
        debugger;
        alert("Error");
      }
    });
    
  });
  
  return content;
}
function editSection() {
  
}

function viewForArticle(path) {
  // Get the article
  runJSON('GET', 'api/find-latest', {
    'title': path,
  }, function(resp) {
    var status = resp.status;
    var content;
    if (status === 200) {
      var art = resp.responseJSON.content;
      console.log(art);
      window.ARTICLE = art;
      content = renderArticle(art);
    }
    else if (status === 404)
      content = renderArticle404(path);
    else {
      debugger;
      alert("Error");
    }
    $("main #innerA").append(content);
  });
  
  return [];
}

function route() {
  var path = window.location.pathname;
  if (path.indexOf('/') === 0)
    path = path.slice(1);

  var content = null;
  if (path === '') {
    content = renderHome();
  }
  else if (path === 'search') {
    content = renderSearch();
  }
  else {
    content = viewForArticle(path);
  }
  
  $("main #innerA").append(content);
}

$(function() {
  route();
})
