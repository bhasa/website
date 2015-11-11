// --- Util ---
function makeEditButton(onclick) {
  return $('<div class="edit_button tb_button">Edit</div>').on('click', onclick);
}
function makeURL(path) {
  // return '/' + path;
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
    // theme: "tomorrow-night",
    value: txt,
  });
  codeMirrorGoEnd(cm);

  return cm;
}
// function hNWithContent(name, val)


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
    $.get(makeURL('item/search'), { 'q': query }, function(data) {
      
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
  
  // Toolbar
  // var editorToolbar = $('<div id="editor_toolbar">');
  
  var sharedCommit = {
    art: art,
    callback: (function() {
      $(this).hide();
      $.ajax({
        url: makeURL('version'),
        method: 'POST',
        
      })
    }),
  };
  var commitButton = $('<div id="commit_button" class="tb_button">Commit</div>');
  commitButton.hide();
  commitButton.on('click', function() {
    sharedCommit.bind(this)();
  });
  // editorToolbar.append(commitButton);
  // content.append(editorToolbar);
  
  // Heading
  var h1 = $('<h1 contenteditable="false" id="title"></h1>');
  h1.text(art.title);
  h1.append(commitButton);
  content.append(h1);
  
  
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
          // TODO: markdown, code, etc
          
          // if (kind === 'md' || kind === 'txt') {
            
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
              }
              
              else if (shared.modeString === 'commit') {
                // Commit mode
                
                // TODO: move this up to a big commit button at the top
                // Create a new version
                /*
                $.ajax({
                  'url': makeURL('version'),
                  'method': 'POST',
                  
                })
                */
              }
            };
            
          // }
          /*
          else {
            // Code
            // 
            // pre.text(innerVal);
            // section.append(pre);
            
            var editor = divWithClass('editor');
            var cm = makeCodeMirror(editor, 'markdown', '');
            // cm.setReadOnly(true);
            cm.setValue(innerVal);
            section.append(editor);

            shared.callback = function() {
              cm.focus();
            };
          }
          */
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
  // content.append(editorToolbar);

  // var submit = divWithClass("submit");
  // submit.text("Create");
  createButton.on('click', function() {
    
    var art = {
        title: path,
        order: ["aaa", "bbb", "ccc"],
        aaa: { title: "AAA", val: "*Hello*", kind: "md" },
        ccc: { title: "CCC", val: "*Hello*", kind: "txt" },
        bbb: { title: "BBB", val: "function foo()", kind: "js" },
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
      $("main #innerA").append(content);
    });
    
  });
  
  return content;
}
function editSection() {
  
}

function viewForArticle(path) {
  // Get the article
  
  /*
  var art = {
    title: path,
    order: ["foo", "baz", "bar"],
    foo: { title: "Foo", val: "*Hello*", kind: "md" },
    bar: { title: "Foo", val: "*Hello*", kind: "txt" },
    baz: { title: "Foo", val: "function foo()", kind: "js" },
  }
  */
  runJSON('GET', 'api/find-latest', {
    'title': path,
  }, function(resp) {
    var status = resp.status;
    var content;
    if (status === 200) {
      var art = resp.responseJSON.content;
      console.log(art);
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

  
  // page('/:name'n, callback[, callback ...])
}

$(function() {
  
  // The plan:
  // 1. query the server for an article
  // 2. render the article as html elements
  // 3. add to the DOM
  
  // $.ajax({
    // '/item?'
  // })
})


$(function() {
  /*
  console.log($("#editor").get(0));
  var cm = CodeMirror($("#editor").get(0), {
    viewportMargin: Infinity,
    mode: "javascript",
    tabSize: 2,
    // lineNumbers: true,
    autofocus: true,
    lineWrapping: true,
    // theme: "tomorrow-night",
    value: $("#hidden_source").text(),
  });
  window.cm = cm;
  cm.execCommand("goDocEnd"); // try once
  setTimeout(function() { cm.execCommand("goDocEnd"); }, 1); // try again
*/
  route();
    
  $("#submit_change").click(function() {
    /*
    var form = $("<form method='post'>");

    var input1 = $("<input type='hidden'>");
    input1.attr("name", "source");
    input1.val(cm.getValue());
    form.append(input1);

    var input2 = $("<input type='hidden'>");
    input2.attr("name", "title");
    input2.val($("h1#title").text());
    form.append(input2);

    form.append($('input[name="csrfmiddlewaretoken"]'));
    form.submit();
    */
    
    
  })
})
