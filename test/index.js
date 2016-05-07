"use strict";
var btn,
    buf,
    buffer,
    entryView,
    grid,
    header,
    label,
    pop,
    scrollView,
    textView;
var GI = require('../lib/index');
GI.startLoop();
global.Gir = GI.importNS('GIRepository');
global.GLib = GI.importNS('GLib');
global.Gio = GI.importNS('Gio');
global.Gdk = GI.importNS('Gdk', '3.0');
global.Gtk = GI.importNS('Gtk', '3.0');
global.GtkSource = GI.importNS('GtkSource', '3.0');
global.Vte = GI.importNS('Vte');
var Orientation = Gtk.Orientation;
var StyleContext = Gtk.StyleContext;
var CssProvider = Gtk.CssProvider;
var Fs = require('/home/romgrk/node_modules/fs-plus');
var Path = require('path');
var Util = require('util');
var ChildP = require('child_process');
var spawnSync = ChildP.spawnSync;
Gtk.init(null, 0);
var schemeManager = GtkSource.StyleSchemeManager.getDefault();
var langManager = GtkSource.LanguageManager.getDefault();
var scheme = schemeManager.getScheme("builder-dark");
var css = new Gtk.CssProvider();
css.loadFromPath(Path.join(__dirname, 'style.css'));
var win = new Gtk.Window({
  title: 'node-gtk',
  type: Gtk.WindowType.TOPLEVEL,
  window_position: Gtk.WindowPosition.CENTER
});
win.setDefaultSize(600, 400);
win.addEventListener('show', Gtk.main);
win.addEventListener('destroy', Gtk.main_quit);
grid = new Gtk.Grid();
header = new Gtk.HeaderBar();
label = new Gtk.Label('label');
header.add(label);
entryView = new Gtk.Entry();
entryView.setIconFromIconName(Gtk.EntryIconPosition.PRIMARY, 'application-exit-symbolic');
entryView.name = 'entry';
scrollView = new Gtk.ScrolledWindow();
textView = new GtkSource.View();
scrollView.add(textView);
btn = new Gtk.Button("yo");
header.add(btn);
pop = new Gtk.Popover(btn);
pop.setSizeRequest(200, 100);
pop.setRelativeTo(btn);
scrollView.margin = 10;
textView.vexpand = true;
textView.hexpand = true;
textView.monospace = true;
textView.showLineNumbers = true;
textView.highlightCurrentLine = true;
buffer = textView.getBuffer();
buffer.setHighlightSyntax(true);
buffer.setStyleScheme(scheme);
grid.attach(header, 0, 0, 2, 1);
grid.attach(scrollView, 0, 1, 2, 1);
grid.attach(entryView, 0, 2, 2, 1);
win.add(grid);
var loadFile = function(filename) {
  var content,
      err,
      error,
      lang;
  try {
    content = Fs.readFileSync(filename);
    lang = langManager.guessLanguage(filename, null);
    if (lang == null)
      lang = langManager.guessLanguage('file.js', null);
    label.setText(filename);
    buffer.setLanguage(lang);
    buffer.setText(content, -1);
    buffer.filename = filename;
    return textView.grabFocus();
  } catch (error) {
    err = error;
    buffer.setLanguage(null);
    return buffer.setText(err.toString(), -1);
  }
};
var saveFile = function(filename) {
  var content,
      error;
  try {
    if (filename == null) {
      filename = buffer.filename;
    }
    var start = buffer.getStartIter();
    var end = buffer.getEndIter();
    content = buffer.getText(start, end, false);
    Fs.writeFileSync(filename, content);
    return console.log(filename + " written " + content.length);
  } catch (error) {
    console.error(error);
  }
};
var resolvePath = function(file) {
  file = Path.resolve(__dirname, Fs.normalize(file));
  if (Fs.fileExistsSync(file)) {
    return file;
  } else {
    return '/home/romgrk/coffeelint.json';
  }
};
var safeEval = function(code) {
  var err,
      error,
      res;
  try {
    res = eval(code);
    return res;
  } catch (error) {
    err = error;
    console.error(err);
  }
  return null;
};
var execute = function(command) {
  var tokens;
  if (command.charAt(0) === '!') {
    return spawnSync(command.substring(1));
  }
  tokens = command.split(' ');
  if (tokens[0] === 'e') {
    if (tokens.length > 1) {
      return loadFile((tokens[1]));
    } else if (buffer.filename != null) {
      return loadFile(buffer.filename);
    } else {
      return console.log('No filename');
    }
  } else if (tokens[0] === 'w') {
    if (tokens.length > 1) {
      return saveFile(resolvePath(tokens[1]));
    } else {
      return saveFile();
    }
  } else if (tokens[0] === 'q') {
    win.close();
    return process.exit();
  } else if (tokens[0] === 'pop') {
    return pop.showAll();
  } else {
    return console.log(command, ' => ', safeEval(command));
  }
};
textView.connect('key-press-event', function(widget, event) {
  global.e = event;
  console.log(event);
  console.log(event.getKeyval);
  console.log(event.__proto__);
  console.log(event.getKeyval());
  console.log(event.key);
  return;
  var key = event.getKeyval.call(event);
  var keyname = Gdk.keyvalName(key);
  btn.label = Gtk.acceleratorGetLabel(event.keyval, event.state);
  if (keyname.match(/(semi)?colon/)) {
    entryView.grabFocus();
    return true;
  }
  if (key === Gdk.KEY_G) {
    buffer.placeCursor(buffer.getEndIter());
    return true;
  }
  if (key === Gdk.KEY_g) {
    var start = buffer.getStartIter();
    buffer.placeCursor(start);
    return true;
  }
  return false;
});
entryView.history = ['pop.get_children()'];
entryView.connect('key-press-event', function(widget, event) {
  return;
  var key = event.keyval;
  var keyname = Gdk.keyvalName(key);
  btn.label = Gtk.acceleratorGetLabel(event.keyval, event.state);
  switch (key) {
    case Gdk.KEY_Tab:
      entryView.setText(entryView.history[0]);
      break;
    case Gdk.KEY_Escape:
      textView.grabFocus();
      break;
    case Gdk.KEY_Return:
      var text = entryView.getText();
      entryView.setText('');
      entryView.history.unshift(text);
      execute(text);
      break;
    default:
      return false;
  }
  return true;
});
btn.connect('clicked', function() {
  if (pop.getVisible()) {
    return pop.hide();
  } else {
    return pop.showAll();
  }
});
loadFile(Path.join(__dirname, 'index.es'));
win.showAll();
//# sourceMappingURL=data:application/json;base64,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QUFDLENBQUM7QUFDYixXQUFLO0FBQUEsQUFDVDtBQUNJLFdBQU8sTUFBSSxDQUFDO0FBRFQsRUFFWDtBQUNBLE9BQU8sS0FBRyxDQUFDO0FBQ2YsQ0FBQyxDQUFDO0FBRUYsRUFBRSxRQUFRLEFBQUMsQ0FBQyxTQUFRLENBQUcsVUFBQyxBQUFELENBQU07QUFDekIsS0FBSSxHQUFFLFdBQVcsQUFBQyxFQUFDLENBQUc7QUFDbEIsU0FBTyxDQUFBLEdBQUUsS0FBSyxBQUFDLEVBQUMsQ0FBQztFQUNyQixLQUFPO0FBQ0gsU0FBTyxDQUFBLEdBQUUsUUFBUSxBQUFDLEVBQUMsQ0FBQztFQUN4QjtBQUFBLEFBQ0osQ0FBQyxDQUFDO0FBR0YsT0FBTyxBQUFDLENBQUMsSUFBRyxLQUFLLEFBQUMsQ0FBQyxTQUFRLENBQUcsV0FBUyxDQUFDLENBQUMsQ0FBQztBQUUxQyxFQUFFLFFBQVEsQUFBQyxFQUFDLENBQUMiLCJmaWxlIjoiL2hvbWUvcm9tZ3JrL3Byb2plY3RzL25vZGUtZ3RrL3Rlc3QvaW5kZXguanMiLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG4vLyA6OmV4ZSBbc2lsZW50ICF0cmFjZXVyIC0tbW9kdWxlcyBjb21tb25qcyAtLXNvdXJjZS1tYXBzIGlubGluZSAtLW91dCAlPGpzICUgXVxuXG52YXIgYnRuLCBidWYgLCBidWZmZXIsXG4gICAgZW50cnlWaWV3LCBncmlkLFxuICAgIGhlYWRlciwgbGFiZWwsXG4gICAgcG9wLFxuICAgIHNjcm9sbFZpZXcsIHRleHRWaWV3O1xuXG5jb25zdCBHSSA9IHJlcXVpcmUoJy4uL2xpYi9pbmRleCcpO1xuR0kuc3RhcnRMb29wKCk7XG5cbmdsb2JhbC5HaXIgICAgICAgICAgPSBHSS5pbXBvcnROUygnR0lSZXBvc2l0b3J5Jyk7XG5nbG9iYWwuR0xpYiAgICAgICAgID0gR0kuaW1wb3J0TlMoJ0dMaWInKTtcbmdsb2JhbC5HaW8gICAgICAgICAgPSBHSS5pbXBvcnROUygnR2lvJyk7XG5nbG9iYWwuR2RrICAgICAgICAgID0gR0kuaW1wb3J0TlMoJ0dkaycsICczLjAnKTtcbmdsb2JhbC5HdGsgICAgICAgICAgPSBHSS5pbXBvcnROUygnR3RrJywgJzMuMCcpO1xuZ2xvYmFsLkd0a1NvdXJjZSAgICA9IEdJLmltcG9ydE5TKCdHdGtTb3VyY2UnLCAnMy4wJyk7XG5nbG9iYWwuVnRlICAgICAgICAgID0gR0kuaW1wb3J0TlMoJ1Z0ZScpO1xuY29uc3QgT3JpZW50YXRpb24gID0gR3RrLk9yaWVudGF0aW9uO1xuY29uc3QgU3R5bGVDb250ZXh0ID0gR3RrLlN0eWxlQ29udGV4dDtcbmNvbnN0IENzc1Byb3ZpZGVyICA9IEd0ay5Dc3NQcm92aWRlcjtcblxuY29uc3QgRnMgICAgID0gcmVxdWlyZSgnL2hvbWUvcm9tZ3JrL25vZGVfbW9kdWxlcy9mcy1wbHVzJylcbmNvbnN0IFBhdGggICA9IHJlcXVpcmUoJ3BhdGgnKTtcbmNvbnN0IFV0aWwgICA9IHJlcXVpcmUoJ3V0aWwnKTtcbmNvbnN0IENoaWxkUCA9IHJlcXVpcmUoJ2NoaWxkX3Byb2Nlc3MnKTtcbmNvbnN0IHNwYXduU3luYyA9IENoaWxkUC5zcGF3blN5bmM7XG5cbkd0ay5pbml0KG51bGwsIDApO1xuXG5jb25zdCBzY2hlbWVNYW5hZ2VyID0gR3RrU291cmNlLlN0eWxlU2NoZW1lTWFuYWdlci5nZXREZWZhdWx0KCk7XG5jb25zdCBsYW5nTWFuYWdlciA9IEd0a1NvdXJjZS5MYW5ndWFnZU1hbmFnZXIuZ2V0RGVmYXVsdCgpO1xuY29uc3Qgc2NoZW1lID0gc2NoZW1lTWFuYWdlci5nZXRTY2hlbWUoXCJidWlsZGVyLWRhcmtcIik7XG5cbnZhciBjc3MgPSBuZXcgR3RrLkNzc1Byb3ZpZGVyKCk7XG5jc3MubG9hZEZyb21QYXRoKFBhdGguam9pbihfX2Rpcm5hbWUsICdzdHlsZS5jc3MnKSk7XG5cbnZhciB3aW4gPSBuZXcgR3RrLldpbmRvdyh7XG4gICAgdGl0bGU6ICdub2RlLWd0aycsXG4gICAgdHlwZTogR3RrLldpbmRvd1R5cGUuVE9QTEVWRUwsXG4gICAgd2luZG93X3Bvc2l0aW9uOiBHdGsuV2luZG93UG9zaXRpb24uQ0VOVEVSXG59KTtcblxud2luLnNldERlZmF1bHRTaXplKDYwMCwgNDAwKTtcbndpbi5hZGRFdmVudExpc3RlbmVyKCdzaG93JywgR3RrLm1haW4pO1xud2luLmFkZEV2ZW50TGlzdGVuZXIoJ2Rlc3Ryb3knLCBHdGsubWFpbl9xdWl0KTtcblxuZ3JpZCAgID0gbmV3IEd0ay5HcmlkKCk7XG5cbmhlYWRlciA9IG5ldyBHdGsuSGVhZGVyQmFyKCk7XG5sYWJlbCAgPSBuZXcgR3RrLkxhYmVsKCdsYWJlbCcpO1xuaGVhZGVyLmFkZChsYWJlbCk7XG5cbmVudHJ5VmlldyA9IG5ldyBHdGsuRW50cnkoKTtcbmVudHJ5Vmlldy5zZXRJY29uRnJvbUljb25OYW1lKEd0ay5FbnRyeUljb25Qb3NpdGlvbi5QUklNQVJZLCAnYXBwbGljYXRpb24tZXhpdC1zeW1ib2xpYycpO1xuLy9lbnRyeVZpZXcuZ2V0U3R5bGVDb250ZXh0KCkuYWRkUHJvdmlkZXIoY3NzLCA5OTk5KTtcbmVudHJ5Vmlldy5uYW1lID0gJ2VudHJ5Jztcblxuc2Nyb2xsVmlldyA9IG5ldyBHdGsuU2Nyb2xsZWRXaW5kb3coKTtcbnRleHRWaWV3ICAgPSBuZXcgR3RrU291cmNlLlZpZXcoKTtcbnNjcm9sbFZpZXcuYWRkKHRleHRWaWV3KTtcblxuYnRuID0gbmV3IEd0ay5CdXR0b24oXCJ5b1wiKTtcbmhlYWRlci5hZGQoYnRuKTtcblxucG9wID0gbmV3IEd0ay5Qb3BvdmVyKGJ0bik7XG5wb3Auc2V0U2l6ZVJlcXVlc3QoMjAwLCAxMDApO1xucG9wLnNldFJlbGF0aXZlVG8oYnRuKTtcbi8vYWRkKHBvcCk7XG5cbnNjcm9sbFZpZXcubWFyZ2luID0gMTA7XG5cbnRleHRWaWV3LnZleHBhbmQgPSB0cnVlO1xudGV4dFZpZXcuaGV4cGFuZCA9IHRydWU7XG50ZXh0Vmlldy5tb25vc3BhY2UgPSB0cnVlO1xudGV4dFZpZXcuc2hvd0xpbmVOdW1iZXJzID0gdHJ1ZTtcbnRleHRWaWV3LmhpZ2hsaWdodEN1cnJlbnRMaW5lID0gdHJ1ZTtcbi8vdGV4dFZpZXcuZ2V0X3N0eWxlX2NvbnRleHQoKS5hZGRfcHJvdmlkZXIoY3NzLCA5OTk5KTtcblxuYnVmZmVyID0gdGV4dFZpZXcuZ2V0QnVmZmVyKCk7XG5idWZmZXIuc2V0SGlnaGxpZ2h0U3ludGF4KHRydWUpO1xuYnVmZmVyLnNldFN0eWxlU2NoZW1lKHNjaGVtZSk7XG5cbmdyaWQuYXR0YWNoKGhlYWRlciwgMCwgMCwgMiwgMSk7XG5ncmlkLmF0dGFjaChzY3JvbGxWaWV3LCAwLCAxLCAyLCAxKTtcbmdyaWQuYXR0YWNoKGVudHJ5VmlldywgMCwgMiwgMiwgMSk7XG5cbndpbi5hZGQoZ3JpZCk7XG5cbmNvbnN0IGxvYWRGaWxlID0gZnVuY3Rpb24oZmlsZW5hbWUpIHtcbiAgICB2YXIgY29udGVudCwgZXJyLCBlcnJvciwgbGFuZztcbiAgICB0cnkge1xuICAgICAgICBjb250ZW50ID0gRnMucmVhZEZpbGVTeW5jKGZpbGVuYW1lKTtcbiAgICAgICAgbGFuZyA9IGxhbmdNYW5hZ2VyLmd1ZXNzTGFuZ3VhZ2UoZmlsZW5hbWUsIG51bGwpO1xuICAgICAgICBpZiAobGFuZyA9PSBudWxsKVxuICAgICAgICAgICAgbGFuZyA9IGxhbmdNYW5hZ2VyLmd1ZXNzTGFuZ3VhZ2UoJ2ZpbGUuanMnLCBudWxsKTtcbiAgICAgICAgbGFiZWwuc2V0VGV4dChmaWxlbmFtZSk7XG4gICAgICAgIGJ1ZmZlci5zZXRMYW5ndWFnZShsYW5nKTtcbiAgICAgICAgYnVmZmVyLnNldFRleHQoY29udGVudCwgLTEpO1xuICAgICAgICBidWZmZXIuZmlsZW5hbWUgPSBmaWxlbmFtZTtcbiAgICAgICAgcmV0dXJuIHRleHRWaWV3LmdyYWJGb2N1cygpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGVyciA9IGVycm9yO1xuICAgICAgICBidWZmZXIuc2V0TGFuZ3VhZ2UobnVsbCk7XG4gICAgICAgIHJldHVybiBidWZmZXIuc2V0VGV4dChlcnIudG9TdHJpbmcoKSwgLTEpO1xuICAgIH1cbn07XG5cbmNvbnN0IHNhdmVGaWxlID0gZnVuY3Rpb24oZmlsZW5hbWUpIHtcbiAgICB2YXIgY29udGVudCwgZXJyb3I7XG4gICAgdHJ5IHtcbiAgICAgICAgaWYgKGZpbGVuYW1lID09IG51bGwpIHtcbiAgICAgICAgICAgIGZpbGVuYW1lID0gYnVmZmVyLmZpbGVuYW1lO1xuICAgICAgICB9XG4gICAgICAgIGxldCBzdGFydCA9IGJ1ZmZlci5nZXRTdGFydEl0ZXIoKTtcbiAgICAgICAgbGV0IGVuZCA9IGJ1ZmZlci5nZXRFbmRJdGVyKCk7XG4gICAgICAgIGNvbnRlbnQgPSBidWZmZXIuZ2V0VGV4dChzdGFydCwgZW5kLCBmYWxzZSk7XG4gICAgICAgIEZzLndyaXRlRmlsZVN5bmMoZmlsZW5hbWUsIGNvbnRlbnQpO1xuICAgICAgICByZXR1cm4gY29uc29sZS5sb2coZmlsZW5hbWUgKyBcIiB3cml0dGVuIFwiICsgY29udGVudC5sZW5ndGgpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xuICAgIH1cbn07XG5cbmNvbnN0IHJlc29sdmVQYXRoID0gZnVuY3Rpb24oZmlsZSkge1xuICAgIGZpbGUgPSBQYXRoLnJlc29sdmUoX19kaXJuYW1lLCBGcy5ub3JtYWxpemUoZmlsZSkpO1xuICAgIGlmIChGcy5maWxlRXhpc3RzU3luYyhmaWxlKSkge1xuICAgICAgICByZXR1cm4gZmlsZTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gJy9ob21lL3JvbWdyay9jb2ZmZWVsaW50Lmpzb24nO1xuICAgIH1cbn07XG5cbmNvbnN0IHNhZmVFdmFsID0gZnVuY3Rpb24oY29kZSkge1xuICAgIHZhciBlcnIsIGVycm9yLCByZXM7XG4gICAgdHJ5IHtcbiAgICAgICAgcmVzID0gZXZhbChjb2RlKTtcbiAgICAgICAgcmV0dXJuIHJlcztcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBlcnIgPSBlcnJvcjtcbiAgICAgICAgY29uc29sZS5lcnJvcihlcnIpO1xuICAgIH1cbiAgICByZXR1cm4gbnVsbDtcbn07XG5cbmNvbnN0IGV4ZWN1dGUgPSBmdW5jdGlvbihjb21tYW5kKSB7XG4gICAgdmFyIHRva2VucztcbiAgICBpZiAoY29tbWFuZC5jaGFyQXQoMCkgPT09ICchJykge1xuICAgICAgICByZXR1cm4gc3Bhd25TeW5jKGNvbW1hbmQuc3Vic3RyaW5nKDEpKTtcbiAgICB9XG5cbiAgICB0b2tlbnMgPSBjb21tYW5kLnNwbGl0KCcgJyk7XG5cbiAgICBpZiAodG9rZW5zWzBdID09PSAnZScpIHtcbiAgICAgICAgaWYgKHRva2Vucy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICByZXR1cm4gbG9hZEZpbGUoKHRva2Vuc1sxXSkpO1xuICAgICAgICB9IGVsc2UgaWYgKGJ1ZmZlci5maWxlbmFtZSAhPSBudWxsKSB7XG4gICAgICAgICAgICByZXR1cm4gbG9hZEZpbGUoYnVmZmVyLmZpbGVuYW1lKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBjb25zb2xlLmxvZygnTm8gZmlsZW5hbWUnKTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAodG9rZW5zWzBdID09PSAndycpIHtcbiAgICAgICAgaWYgKHRva2Vucy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICByZXR1cm4gc2F2ZUZpbGUocmVzb2x2ZVBhdGgodG9rZW5zWzFdKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gc2F2ZUZpbGUoKTtcbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAodG9rZW5zWzBdID09PSAncScpIHtcbiAgICAgICAgd2luLmNsb3NlKCk7XG4gICAgICAgIHJldHVybiBwcm9jZXNzLmV4aXQoKTtcbiAgICB9IGVsc2UgaWYgKHRva2Vuc1swXSA9PT0gJ3BvcCcpIHtcbiAgICAgICAgcmV0dXJuIHBvcC5zaG93QWxsKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGNvbnNvbGUubG9nKGNvbW1hbmQsICcgPT4gJywgc2FmZUV2YWwoY29tbWFuZCkpO1xuICAgIH1cbn07XG5cblxuXG50ZXh0Vmlldy5jb25uZWN0KCdrZXktcHJlc3MtZXZlbnQnLCBmdW5jdGlvbih3aWRnZXQsIGV2ZW50KSB7XG4gICAgZ2xvYmFsLmUgPSBldmVudDtcbiAgICBjb25zb2xlLmxvZyhldmVudCk7XG4gICAgY29uc29sZS5sb2coZXZlbnQuZ2V0S2V5dmFsKVxuICAgIGNvbnNvbGUubG9nKGV2ZW50Ll9fcHJvdG9fXylcbiAgICBjb25zb2xlLmxvZyhldmVudC5nZXRLZXl2YWwoKSk7XG4gICAgY29uc29sZS5sb2coZXZlbnQua2V5KTtcbiAgICByZXR1cm47XG4gICAgbGV0IGtleSA9IGV2ZW50LmdldEtleXZhbC5jYWxsKGV2ZW50KTtcbiAgICBsZXQga2V5bmFtZSA9IEdkay5rZXl2YWxOYW1lKGtleSk7XG4gICAgYnRuLmxhYmVsID0gR3RrLmFjY2VsZXJhdG9yR2V0TGFiZWwoZXZlbnQua2V5dmFsLCBldmVudC5zdGF0ZSk7XG4gICAgLy9jb25zb2xlLmxvZygnS2V5UHJlc3M6ICcsICk7XG4gICAgaWYgKGtleW5hbWUubWF0Y2goLyhzZW1pKT9jb2xvbi8pKSB7XG4gICAgICAgIGVudHJ5Vmlldy5ncmFiRm9jdXMoKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIGlmIChrZXkgPT09IEdkay5LRVlfRykge1xuICAgICAgICBidWZmZXIucGxhY2VDdXJzb3IoYnVmZmVyLmdldEVuZEl0ZXIoKSk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBpZiAoa2V5ID09PSBHZGsuS0VZX2cpIHtcbiAgICAgICAgbGV0IHN0YXJ0ID0gYnVmZmVyLmdldFN0YXJ0SXRlcigpO1xuICAgICAgICBidWZmZXIucGxhY2VDdXJzb3Ioc3RhcnQpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xufSk7XG5cbmVudHJ5Vmlldy5oaXN0b3J5ID0gWydwb3AuZ2V0X2NoaWxkcmVuKCknXTtcbmVudHJ5Vmlldy5jb25uZWN0KCdrZXktcHJlc3MtZXZlbnQnLCBmdW5jdGlvbih3aWRnZXQsIGV2ZW50KSB7XG4gICAgcmV0dXJuO1xuICAgIGxldCBrZXkgPSBldmVudC5rZXl2YWw7XG4gICAgbGV0IGtleW5hbWUgPSBHZGsua2V5dmFsTmFtZShrZXkpO1xuICAgIGJ0bi5sYWJlbCA9IEd0ay5hY2NlbGVyYXRvckdldExhYmVsKGV2ZW50LmtleXZhbCwgZXZlbnQuc3RhdGUpO1xuICAgIHN3aXRjaCAoa2V5KSB7XG4gICAgICAgIGNhc2UgR2RrLktFWV9UYWI6XG4gICAgICAgICAgICBlbnRyeVZpZXcuc2V0VGV4dChlbnRyeVZpZXcuaGlzdG9yeVswXSk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBHZGsuS0VZX0VzY2FwZTpcbiAgICAgICAgICAgIHRleHRWaWV3LmdyYWJGb2N1cygpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgR2RrLktFWV9SZXR1cm46XG4gICAgICAgICAgICBsZXQgdGV4dCA9IGVudHJ5Vmlldy5nZXRUZXh0KCk7XG4gICAgICAgICAgICBlbnRyeVZpZXcuc2V0VGV4dCgnJyk7XG4gICAgICAgICAgICBlbnRyeVZpZXcuaGlzdG9yeS51bnNoaWZ0KHRleHQpO1xuICAgICAgICAgICAgZXhlY3V0ZSh0ZXh0KTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbn0pO1xuXG5idG4uY29ubmVjdCgnY2xpY2tlZCcsICgpID0+IHtcbiAgICBpZiAocG9wLmdldFZpc2libGUoKSkge1xuICAgICAgICByZXR1cm4gcG9wLmhpZGUoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gcG9wLnNob3dBbGwoKTtcbiAgICB9XG59KTtcblxuXG5sb2FkRmlsZShQYXRoLmpvaW4oX19kaXJuYW1lLCAnaW5kZXguZXMnKSk7XG5cbndpbi5zaG93QWxsKCk7XG4iXX0=
