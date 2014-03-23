// THE COMPLETIONIST'S EPISODE SELECTION APP
//
// Open Chrome with 'google-chrome --disable-web-security'
//
// Retrieve shows which the user is watching
// --> https://trakt.tv/api-docs/user-library-shows-collection
//     http://api.trakt.tv/user/library/shows/collection.format/apikey/username
// Retrieve collection progress for the shows the user is watching
// --> https://trakt.tv/api-docs/user-progress-collected
//     http://api.trakt.tv/user/progress/watched.format/apikey/username/title/sort/extended
// Suggest a next episode to watch.
// --> https://trakt.tv/api-docs/show-episode-stats
//     http://api.trakt.tv/show/episode/stats.format/apikey/title/season/episode

var WL = (function($){
  var API_KEY = '8bde53c3108a625150ddd2b974395280',
      API_BASE = 'http://api.trakt.tv',
      API_FORMAT = 'json',
      TRAKT_USER = 'tijptjik';

  var collection,
      watched,
      data = [];

  function getCollection(opts, callback){
    var opts = opts || {},
        username = opts.username || TRAKT_USER,
        format = opts.format || API_FORMAT,
        callback = callback || getWatched,
        url = [API_BASE, 'user/library/shows/collection.' + format, API_KEY, username].join('/');

    $.getJSON( url )
      .done(function( json ) {
        collection = json;
        callback({username:username, collection:collection}, mapData)
      })
      .fail(function( jqxhr, textStatus, error ) {
          logFail(jqxhr, textStatus, error );
        });
  }

  function getWatched(opts, callback){
    var username = opts.username || TRAKT_USER,
        titles = opts.titles || null,
        format = opts.format || API_FORMAT,
        collection = opts.collection || collection,
        callback = callback || mapData,
        url = [API_BASE, 'user/progress/watched.' + format, API_KEY, username, safeURL(titles)].join('/');

    $.getJSON( url )
      .done(function( json ) {
        watched = json;
        callback({collection: collection, watched: json}, render)
      })
      .fail(function( jqxhr, textStatus, error ) {
        logFail(jqxhr, textStatus, error );
      });
  }

  function getEpisode(data, tvdb_id, season, episode){
    var url = [API_BASE, 'show/episode/summary.' + API_FORMAT, API_KEY, tvdb_id, season, episode].join('/');
    $.getJSON( url )
      .done(function( json ) {
        var show = findShow(data, json.show.title),
            now = Math.round(+new Date()/1000);
               
        show.episode_title = json.episode.title;
        show.episode_image = json.episode.images.screen;
        show.air_date = json.episode.first_aired;
        show.has_aired = ( now > show.air_date);
        
      })
      .fail(function( jqxhr, textStatus, error ) {
        logFail(jqxhr, textStatus, error );
      });
  }

// Data Manipulation Methods

  function mapData(opts, callback){
    var opts = opts || {},
        collection = opts.collection || collection,
        watched = opts.watched || watched,
        callback = callback || render;

    data = mapCollection(collection, watched, data);
    data = mapWatched(watched, data);
   
    callback(data);
  }

  function mapCollection(collection, watched, data){

    var unstarted = filterUnstarted(collection, watched);

    unstarted.forEach(function(elem, i){
      data.push({
          'title' : elem.title,
          'season' : 1,
          'episode' : 1,
          'genres' : elem.genres,
          'images' : elem.images,
          'year' : elem.year,        
          'available' : true,
          'started' : false,
          'completed': false
      });
      getEpisode(data, elem.tvdb_id, 1, 1);
    })

    return data;
  }

  function filterUnstarted(collection, watched){
    var showIDs = {}
    watched.forEach(function(obj){
      showIDs[obj.show.tvdb_id] = obj;
    });

    return collection.filter(function(obj){
      return !(obj.tvdb_id in showIDs);
    });
  }

  function mapWatched(watched, data){
    watched.forEach(function(elem,i){
      var title = elem['show'].title,
          show = findShow(collection, title),
          rec = elem['next_episode'],
          s = rec.season,
          e = rec.number,
          now = Math.round(+new Date()/1000);

      if (show != null && s != undefined && e != undefined){
        data.push({
          'title' : title,
          'season' : s,
          'episode' : e,
          'episode_title': rec.title,
          'episode_image' : rec.images.screen,
          'genres' : show.genres,
          'images' : show.images,
          'year' : show.year,
          'air_date' : rec.first_aired,
          'has_aired' : ( now > rec.first_aired),
          'available' : isEpisodeAvailable(show, s, e),
          'started' : true,
          'completed': (elem['progress']['percentage'] == 100)
      });
      }
    })
  }

  function findShow(arr, title){
    var result = null;
    for (var i = 0; i < arr.length; i++) {
      if (arr[i]['title'] === title){
          result = arr[i];
        };
      };
    return result;
  }

  function findSeason(show, season){
    var result = null;
    for (var i = 0; i < show['seasons'].length; i++) {
      if (show['seasons'][i]['season'] === season){
          result = show['seasons'][i];
        };
      };
    return result;
  }

  function hasEpisode(season, episode){
    var result = false;
    if (season != null && season['episodes'].indexOf(episode) != -1){
      result = true;
    }
    return result;
  }

  function isEpisodeAvailable(show, season, episode){
    var availability = false;
    var season = findSeason(show, season);
    if (hasEpisode(season, episode)) {
      availability = true;
    }
    return availability
  }

  function render(data){

    var source   = $("#shows-list").html();
    var template = Handlebars.compile(source);
    var context = {shows : WL.data};
    var html     = template(context);

    $('main').append(html);
  }

// Helper Methods

  function logFail(jqxhr, textStatus, error){
    var err = textStatus + ", " + error;
    console.log( "Request Failed: " + err );
  }

  function safeURL(query){
    var param = null;
    if (typeof query === "string"){
      param = query.replace(/\s/g,'-').toLowerCase();
    } else {
      if (query != null){
        param = query.join(',').replace(/\s/g,'-');
      }
    }
    return param;
  }

  function stripTitles(data){
    return data.map(function(show){return show.title})
  }

  function pad(num, size) {
    var size = size || 2,
        s = num+"";
    while (s.length < size) s = "0" + s;
    return s;
}

  function torrent(title, s, e, quality){
    var quality = quality || '720p',
        url = 'http://kickass.to/usearch/' + title + '%20s' + pad(s) + 'e' + pad(e) + '%20' + quality +'/?field=seeders&sorder=desc';
    $.get(url).done(function(data, textStatus, jqXHR, magnet) {
      var magnet = $(data).find('[title="Torrent magnet link"]').attr('href');
      OpenInNewTab(magnet);
    })
  }

  function OpenInNewTab(url){
    var win=window.open(url, '_blank');
    win.focus();
  }

  function daysTillAirdata(airdate){
    var remaining_secs = airdate - Math.round(+new Date()/1000);
    return Math.floor(remaining_secs / 86400);
  }

  function init(){
    getCollection()
  }

// Public API

  return {
    data : data,
    torrent: torrent,
    init : init
  }

})(jQuery);

WL.init();
