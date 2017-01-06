(function() {

  'use strict';

  let optionsHTML = require('html!../templates/session.detail.options.html');

  /**
   * @class SessionDetailController
   * @classdesc Interacts with session details
   */
  class SessionDetailController {

    /* setup --------------------------------------------------------------- */
    /**
     * Initialize global variables for this controller
     * @param $sce            Angular strict contextual escaping service
     * @param $scope          Angular application model object
     * @param $routeParams    Retrieve the current set of route parameters
     * @param SessionService  Transacts sessions with the server
     * @param ConfigService   Transacts app configurations with the server
     * @param FieldService    Retrieves available fields from the server
     *
     * @ngInject
     */
    constructor($sce, $scope, $routeParams, SessionService, ConfigService, FieldService) {
      this.$sce           = $sce;
      this.$scope         = $scope;
      this.$routeParams   = $routeParams;
      this.SessionService = SessionService;
      this.ConfigService  = ConfigService;
      this.FieldService   = FieldService;
    }

    /* Callback when component is mounted and ready */
    $onInit() {
      this.loading = true;
      this.loadingPackets = true;
      this.error = false;

      // default session detail parameters
      // add to $scope so session.detail.options can use it
      this.$scope.params = {
        base  : 'hex',
        line  : false,
        image : false,
        gzip  : false,
        ts    : false,
        decode: {}
      };

      if (localStorage) { // display browser saved options
        if (localStorage['moloch-base']) {
          this.$scope.params.base = localStorage['moloch-base'];
        }
        if (localStorage['moloch-ts']) {
          this.$scope.params.ts = JSON.parse(localStorage['moloch-ts']);
        }
        if (localStorage['moloch-line']) {
          this.$scope.params.line = JSON.parse(localStorage['moloch-line']);
        }
        if (localStorage['moloch-gzip']) {
          this.$scope.params.gzip = JSON.parse(localStorage['moloch-gzip']);
        }
        if (localStorage['moloch-image']) {
          this.$scope.params.image = JSON.parse(localStorage['moloch-image']);
        }
      }

      this.getDetailData(); // get SPI data

      this.getPackets();    // get packet data

      this.ConfigService.getMolochClickables()
        .then((response) => {
          this.$scope.molochClickables = response;
        });

      this.FieldService.get()
        .then((response) => {
          this.$scope.molochFields = response;
        });

      /* LISTEN! */
      this.$scope.$on('open:form:container', (event, args) => {
        this.$scope.displayFormContainer(args);
      });

      this.$scope.$on('close:form:container', (event, args) => {
        this.$scope.hideFormContainer();

        if (args) {
          if (args.reloadData)  {
            if (args.message) { this.getDetailData(args.message); }
            else { this.getDetailData(); }
          } else if (args.message) {
            this.$scope.displayMessage(args.message);
          }
        }
      });
    }


    /* exposed functions --------------------------------------------------- */
    /**
     * Gets the session detail from the server
     * @param {string} message An optional message to display to the user
     */
    getDetailData(message) {
      if (localStorage) { // update browser saved options
        localStorage['moloch-base']   = this.$scope.params.base;
        localStorage['moloch-line']   = this.$scope.params.line;
        localStorage['moloch-gzip']   = this.$scope.params.gzip;
        localStorage['moloch-image']  = this.$scope.params.image;
      }

      this.SessionService.getDetail(this.$scope.session.id,
        this.$scope.session.no, this.$scope.params)
        .then((response) => {
          this.loading = false;
          this.$scope.detailHtml = this.$sce.trustAsHtml(response.data);

          this.$scope.renderDetail();

          if (message) { this.$scope.displayMessage(message); }
        })
        .catch((error) => {
          this.loading = false;
          this.error   = error;
        });
    }

    getPackets() {
      this.SessionService.getPackets(this.$scope.session.id,
         this.$scope.session.no, this.$scope.params)
         .then((response) => {
           this.loadingPackets = false;
           this.$scope.packetHtml = this.$sce.trustAsHtml(response.data);

           this.$scope.renderPackets();
         })
         .catch((error) => {
           this.loadingPackets = false;
           this.errorPackets   = error;
         });
    }

    /* Toggles the view of packet timestamps */
    toggleTimeStamps() {
      if (localStorage) { // update browser saved ts
        localStorage['moloch-ts'] = this.$scope.params.ts;
      }
    }

    /**
     * Shows more items in a list of values
     * @param {object} e The click event
     */
    showMoreItems(e) {
      $(e.target).hide().prev().show();
    }

    /**
     * Hides more items in a list of values
     * @param {object} e The click event
     */
    showFewerItems(e) {
      $(e.target).parent().hide().next().show();
    }

    /**
     * Adds a rootId expression
     * @param {string} rootId The root id of the session
     * @param {int} startTime The start time of the session
     */
    allSessions(rootId, startTime) {
      let fullExpression = `rootId == \"${rootId}\"`;

      this.$scope.$emit('add:to:search', { expression: fullExpression });

      if (this.$routeParams.startTime) {
        if (this.$routeParams.startTime < startTime) {
          startTime = this.$routeParams.startTime;
        }
      }

      this.$scope.$emit('change:time', { start:startTime });
    }

  }

  SessionDetailController.$inject = ['$sce','$scope', '$routeParams',
    'SessionService','ConfigService','FieldService'];


  angular.module('moloch')
    .directive('sessionDetail', ['$timeout', '$filter', '$compile', '$routeParams',
    function($timeout, $filter, $compile, $routeParams) {
      return {
        template    : require('html!../templates/session.detail.html'),
        controller  : SessionDetailController,
        controllerAs: '$ctrl',
        scope       : { session: '=' },
        link        : function SessionDetailLink(scope, element, attrs, ctrl) {

          /* exposed functions --------------------------------------------- */
          let formHTMLs = {
            'add:tags'      : `<div class="margined-bottom-xlg">
                                <session-tag class="form-container"
                                sessions="[session]" add="true"></session-tag>
                              </div>`,
            'remove:tags'   : `<div class="margined-bottom-xlg">
                                <session-tag class="form-container"
                                sessions="[session]" add="false"></session-tag>
                              </div>`,
            'export:pcap'   : `<div class="margined-bottom-xlg">
                                <export-pcap class="form-container"
                                sessions="[session]"></export-pcap>
                              </div>`,
            'scrub:pcap'    : `<div class="margined-bottom-xlg">
                                <scrub-pcap class="form-container"
                                sessions="[session]"></scrub-pcap>
                              </div>`,
            'delete:session': `<div class="margined-bottom-xlg">
                                <session-delete class="form-container"
                                sessions="[session]"></session-delete>
                              </div>`,
            'send:session'  : `<div class="margined-bottom-xlg">
                                <session-send class="form-container"
                                sessions="[session]" cluster="cluster"></session-send>
                              </div>`
          };

          scope.displayFormContainer = function(args) {
            let formContainer = element.find('.form-container');
            let html = formHTMLs[args.form];

            // pass in the cluster for sending session
            if (args.cluster) { scope.cluster = args.cluster; }

            if (html) {
              let content = $compile(html)(scope);
              formContainer.replaceWith(content);
            }
          };

          scope.displayMessage = function(message) {
            $timeout(function() { // timeout to wait for detail to render
              // display a message to the user (overrides form)
              let formContainer = element.find('.form-container');
              let html = `<div class="form-container">
                            <toast message="'${message}'" type="'success'"></toast>
                          </div>`;

              let content = $compile(html)(scope);
              formContainer.replaceWith(content);
            });
          };

          scope.hideFormContainer = function() {
            element.find('.form-container').hide();
          };


          /**
           * Renders the session detail html
           * Then the session actions menu
           * Then the packet options
           */
          let srccol, dstcol, imgs;

          scope.renderDetail = function() {
            // compile and render the session detail
            let template = `<div class="detail-container" ng-class="{'show-ts':params.ts === true}">${scope.detailHtml}</div>`;
            let compiled = $compile(template)(scope);
            element.find('.detail-container').replaceWith(compiled);

            $timeout(function() { // wait until session detail is rendered
              let i, len, time, value, timeEl;

              // display session actions dropdown
              let actionsEl = element.find('.session-actions-menu');
              if (actionsEl.find('session-actions').length === 0) {
                let actionsContent  = $compile('<session-actions></session-actions>')(scope);
                actionsEl.append(actionsContent);
                actionsEl.dropdown();
              }

              // // display packet option buttons
              // let optionsEl   = element.find('.packet-options');
              // let optContent  = $compile(optionsHTML)(scope);
              // optionsEl.replaceWith(optContent);
              //
              // // modify the packet timestamp values
              // let tss = element[0].querySelectorAll('.session-detail-ts');
              // for (i = 0, len = tss.length; i < len; ++i) {
              //   timeEl  = tss[i];
              //   value   = timeEl.getAttribute('ts');
              //   timeEl  = timeEl.querySelectorAll('.ts-value');
              //   if (!isNaN(value)) { // only parse value if it's a number (ms from 1970)
              //     time = $filter('date')(value, 'yyyy/MM/dd HH:mm:ss.sss');
              //     timeEl[0].innerHTML = time;
              //   }
              // }
              //
              // // add tooltips to display source/destination byte visualization
              // srccol = element[0].querySelector('.srccol');
              // if (srccol) {
              //   $(srccol).tooltip({ placement:'right', html:true });
              // }
              //
              // dstcol = element[0].querySelector('.dstcol');
              // if (dstcol) {
              //   $(dstcol).tooltip({ placement:'right', html:true });
              // }
              //
              // imgs = element[0].querySelectorAll('.imagetag');
              // for (i = 0, len = imgs.length; i < len; ++i) {
              //   let img = imgs[i];
              //   let href = img.getAttribute('href');
              //   href = href.replace('body', 'bodypng');
              //   $(img).tooltip({
              //     placement : 'top',
              //     html      : true,
              //     title     : `File Bytes:<br><img src="${href}">`
              //   });
              // }
            });
          };
          
          scope.renderPackets = function() {
            let template = `<div class="packet-container" ng-class="{'show-ts':params.ts === true}">${scope.packetHtml}</div>`;
            // let compiled = $compile(template)(scope);
            element.find('.packet-container').replaceWith(template);

            $timeout(function() { // wait until session packets are rendered
              let i, len, time, value, timeEl;

              // display packet option buttons
              let optionsEl   = element.find('.packet-options');
              let optContent  = $compile(optionsHTML)(scope);
              optionsEl.replaceWith(optContent);
  
              // modify the packet timestamp values
              let tss = element[0].querySelectorAll('.session-detail-ts');
              for (i = 0, len = tss.length; i < len; ++i) {
                timeEl  = tss[i];
                value   = timeEl.getAttribute('ts');
                timeEl  = timeEl.querySelectorAll('.ts-value');
                if (!isNaN(value)) { // only parse value if it's a number (ms from 1970)
                  time = $filter('date')(value, 'yyyy/MM/dd HH:mm:ss.sss');
                  timeEl[0].innerHTML = time;
                }
              }
  
              // add tooltips to display source/destination byte visualization
              srccol = element[0].querySelector('.srccol');
              if (srccol) {
                $(srccol).tooltip({ placement:'right', html:true });
              }
  
              dstcol = element[0].querySelector('.dstcol');
              if (dstcol) {
                $(dstcol).tooltip({ placement:'right', html:true });
              }
  
              imgs = element[0].querySelectorAll('.imagetag');
              for (i = 0, len = imgs.length; i < len; ++i) {
                let img = imgs[i];
                let href = img.getAttribute('href');
                href = href.replace('body', 'bodypng');
                $(img).tooltip({
                  placement : 'top',
                  html      : true,
                  title     : `File Bytes:<br><img src="${href}">`
                });
              }
            });
          };


          // cleanup! cleanup! everybody, everywhere
          scope.$on('$destroy', function() {
            // remove listeners to prevent memory leaks
            if (srccol) { $(srccol).tooltip('destroy'); }

            if (dstcol) { $(dstcol).tooltip('destroy'); }

            if (imgs) {
              for (let i = 0, len = imgs.length; i < len; ++i) {
                $(imgs[i]).tooltip('destroy');
              }
            }
          });

        }
      };
    }]);

})();
