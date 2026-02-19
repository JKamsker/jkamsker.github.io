$(document).ready(function() {
    'use strict';
    var search_field = $('.search-form__field'),
        search_results = $('.search-results'),
        toggle_search = $('.toggle-search-button'),
        close_search = $('.close-search-button'),
        search_container = $('.search-form-container'),
        search_result_template = "\
          <div class='search-results__item'>\
            <a class='search-results__item__title' href='{{link}}'>{{title}}</a>\
            <span class='search-results__item__date'>{{pubDate}}</span>\
          </div>";

    function closeSearch() {
      search_container.removeClass('is-active');
    }

    // Toggle: second click on search button closes
    toggle_search.click(function(event) {
      event.preventDefault();
      if (search_container.hasClass('is-active')) {
        closeSearch();
      } else {
        search_container.addClass('is-active');
        setTimeout(function() { search_field.focus(); }, 100);
      }
    });

    // ESC closes
    search_container.on('keyup', function(event) {
      if (event.keyCode == 27) {
        closeSearch();
      }
    });

    // Click anywhere in the overlay that isn't the input, a result link,
    // or the close button itself → close search
    search_container.on('click', function(event) {
      var $target = $(event.target);
      // Let result links navigate naturally
      if ($target.closest('.search-results__item__title').length) return;
      // Don't close when interacting with the input
      if ($target.closest('.search-form').length) return;
      // Don't double-fire with the close button handler
      if ($target.closest('.close-search-button').length) return;
      closeSearch();
    });

    close_search.click(function() {
      closeSearch();
    });

    search_field.ghostHunter({
      results: search_results,
      onKeyUp         : true,
      rss             : base_url + '/feed.xml',
      zeroResultsInfo : false,
      info_template   : "<h4 class='heading'>Number of posts found: {{amount}}</h4>",
      result_template : search_result_template,
      before: function() {
        search_results.fadeIn();
      }
    });

  });
