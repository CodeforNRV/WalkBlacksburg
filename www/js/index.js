/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

var map;
var directionsService;
var directionsDisplay;
var currentLocation = null;
var roadsLayer = null;
var accuracyCircle = null;
var watchID = null;
var markers = [];
var settings = {
    isNight: isNight(),
    alternateColors: false
};

var app = {
    // Application Constructor
    initialize: function() {
        this.bindEvents();
        setupMap();
    },
    // Bind Event Listeners
    //
    // Bind any events that are required on startup. Common events are:
    // 'load', 'deviceready', 'offline', and 'online'.
    bindEvents: function() {
        watchID = navigator.geolocation.watchPosition(onLocationSuccess, onLocationError, {timeout: 5000});
        document.addEventListener('deviceready', this.onDeviceReady, false);
    },
    // deviceready Event Handler
    //
    // The scope of 'this' is the event. In order to call the 'receivedEvent'
    // function, we must explicitly call 'app.receivedEvent(...);'
    onDeviceReady: function() {
        console.log('Device ready');
        watchID = navigator.geolocation.watchPosition(onLocationSuccess, onLocationError, {timeout: 5000});
        document.addEventListener("backbutton", onBackKeyDown, false);
    }

};

function setupMap() {
    var bburg = new google.maps.LatLng(37.230618, -80.415357);
    var mapOptions = {
        zoom: 13,
        center: bburg,
        zoomControl: true,
        streetViewControl: false
    };
    map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);
    directionsService = new google.maps.DirectionsService();
    var directionsRendererOptions = {
        polylineOptions: {
            strokeColor: '#999',
            strokeOpacity: 0.5,
            strokeWeight: 15
        }
    };
    directionsDisplay = new google.maps.DirectionsRenderer(directionsRendererOptions);
    directionsDisplay.setMap(map);
    // NOTE: The url provided to the kml MUST be publicly accessible
    /*var safeStreetOverlay = new google.maps.KmlLayer({
        url: "http://dry-castle-3287.herokuapp.com/overlay.kml",
    });
    safeStreetOverlay.setMap(map);*/
    var path = window.location.href.replace('index.html', '')
    roadsLayer = new google.maps.Data();
    $.getJSON("roads.json", function(data) {
        roadsLayer.addGeoJson(data);
    });

    roadsLayer.setStyle(function(feature) {
        return setMapStyle(feature);
    });
    roadsLayer.addListener('click', function(event) {
        $('#roadName').html(event.feature.getProperty('lb'));
        $('#speedlimit').html(event.feature.getProperty('s'));
        $('#sidewalks').html(trueFalseConverter(event.feature.getProperty('sw')));
        $('#streetlights').html(trueFalseConverter(event.feature.getProperty('sl')));
        $('#queryModal').modal('show');
    });
    roadsLayer.setMap(map);

    // Create the search box and link it to the UI element.
    var input = /** @type {HTMLInputElement} */(
        document.getElementById('search-terms'));

    var searchBox = new google.maps.places.SearchBox(
        /** @type {HTMLInputElement} */(input));

    google.maps.event.addListener(searchBox, 'places_changed', function() {
        var places = searchBox.getPlaces();
        if (places.length == 0) {
            return;
        }
        for (var i = 0, marker; marker = markers[i]; i++) {
            marker.setMap(null);
        }

        // For each place, get the icon, place name, and location.
        markers = [];
        var bounds = new google.maps.LatLngBounds();
        for (var i = 0, place; place = places[i]; i++) {
            console.log('Adding place: ' + place.name);

            var transitDirectionsRequest = {
                origin: currentLocation.position,
                destination: place.geometry.location,
                travelMode: google.maps.TravelMode.WALKING
            };
            directionsService.route(transitDirectionsRequest, function(result, status) {
                if (status == google.maps.DirectionsStatus.OK) {
                    directionsDisplay.setDirections(result);
                    scoreWalkingDirections(result.routes[0].overview_path);
                }
            });
        }

        map.fitBounds(bounds);
    });

    // Bias the SearchBox results towards places that are within the bounds of the
    // current map's viewport.
    google.maps.event.addListener(map, 'bounds_changed', function() {
        var bounds = map.getBounds();
        searchBox.setBounds(bounds);
    });
    //On zoom change, we can set the weight of our streets higher
    google.maps.event.addListener(map, 'zoom_changed', function() {
        var zoomScale = 1;
        if (map.getZoom() >= 16) {
            zoomScale = 3;
        }
    });
}

$('#locate-btn').on('click', function (e) {
    locateMe();
});

$('#search-btn').on('click', function(e) {
    e.stopPropagation();
    if (!$('#dest-search').hasClass('dest-search-open')) {
        $('#dest-search').addClass('dest-search-open');
        //$('.dropdown-menu').slideUp(); Need to do this 'properly'
        setTimeout(function() {
            $('#search-terms').focus();
        }, 100);
    } else {
        if ($('#search-terms').val() == "") {
            $('#dest-search').removeClass('dest-search-open');
            $('#search-terms').blur();
        } else {
            $('#search-form').submit();
        }

    }
});
$('#dest-search-input').on('click', function(e) {
    e.stopPropagation();
});
$('#search-form').submit(function(e) {
    e.preventDefault();
});

// ADD SLIDEDOWN ANIMATION TO DROPDOWN //
$('.dropdown').on('show.bs.dropdown', function(e){
    $(this).find('.dropdown-menu').first().stop(true, true).slideDown();
});

// ADD SLIDEUP ANIMATION TO DROPDOWN //
$('.dropdown').on('hide.bs.dropdown', function(e){
    $(this).find('.dropdown-menu').first().stop(true, true).slideUp();
});

$('#isNight-checkbox').bootstrapSwitch('state', settings.isNight, true);
$('#isNight-checkbox').on('switchChange.bootstrapSwitch', function(event, state) {
    settings.isNight = state;
    roadsLayer.setStyle(function(feature) {
        return setMapStyle(feature);
    });
});

$('#alternateColors-checkbox').on('switchChange.bootstrapSwitch', function(event, state) {
    settings.alternateColors = state;
    roadsLayer.setStyle(function(feature) {
        return setMapStyle(feature);
    });
});

$('.styled-switch').bootstrapSwitch();


function mobilecheck() {
    var check = false;
    (function(a){if(/(android|ipad|playbook|silk|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4)))check = true})(navigator.userAgent||navigator.vendor||window.opera);
    return check;
}

function isNight() {
    var today = new Date();
    var times = SunCalc.getTimes(today, 37.23, -80.4178);
    if (today > times.sunrise && today < times.sunset) {
        return false;
    } else {
        return true;
    }
}

function trueFalseConverter(value) {
    console.log(value);
    if (value === true) { return "Yes"; }
    else return "No";
}

function toggleDisplay(event) {
    var searchBox = document.getElementById('search-terms');
    if (searchBox.style.display == 'none') {
        searchBox.style.display = 'block';
    } else {
        searchBox.style.display = 'none';
    }
}

function styleRoads() {
    var zoomScale = 1;
    if (map.getZoom() >= 16) {
        zoomScale = 2;
    }
}

function locateMe() {
    if (currentLocation === null) {
        watchID = navigator.geolocation.watchPosition(onLocationSuccess, onLocationError, {timeout: 5000});
        $.notify({
            // options
            message: 'Trying to get your location...'
        },{
            // settings
            type: 'info',
            placement: {
                from: "bottom",
                align: "center"
            },
            animate: {
                enter: "animated fadeInUp",
                exit: "animated fadeOutDown"
            },
            allow_dismiss: false,
            delay: 3000
        });
    } else {
        map.setZoom(17);
        map.panTo(currentLocation.position);
    }
}

function onLocationSuccess(position) {
    var centerPosition = new google.maps.LatLng(position.coords.latitude, position.coords.longitude)
    if (currentLocation === null) {
        var locationIcon = {
            url: 'img/location.png',
            size: new google.maps.Size(15, 15),
            anchor: new google.maps.Point(7,7)
        };
        currentLocation = new google.maps.Marker({
            position: centerPosition,
            map: map,
            title: 'Your location',
            icon: locationIcon
        });
    }

    currentLocation.setPosition(centerPosition);
    if (accuracyCircle === null) {
        accuracyCircle = new google.maps.Circle({
            center: centerPosition,
            radius: position.coords.accuracy,
            map: map,
            fillColor: 'blue',
            fillOpacity: 0.05,
            strokeColor: 'blue',
            strokeOpacity: 0.1
        });
    } else {
        accuracyCircle.setCenter(centerPosition);
        accuracyCircle.setRadius(position.coords.accuracy);
    }
}

function onLocationError(error) {
    console.log('onLocationError, code: ' + error.code + '\n message: ' + error.message + '\n');
    currentLocation.setMap(null);
    $.notify({
        // options
        message: 'Could not get your location'
    }, {
        // settings
        type: 'warning',
        placement: {
            from: "bottom",
            align: "center"
        },
        animate: {
            enter: "animated fadeInUp",
            exit: "animated fadeOutDown"
        },
        allow_dismiss: false,
        delay: 4000
    });
}

function setMapStyle(feature) {
    var altColors = {'red': '#d7191c', 'yellow': '#fc8d59', 'green': '#2c7bb6'};
    if (settings.isNight) {
        if (settings.alternateColors) {
            color = altColors[feature.getProperty('n')];
        } else {
            color = feature.getProperty('n');
        }
    } else {
        if (settings.alternateColors) {
            color = altColors[feature.getProperty('d')];
        } else {
            color = feature.getProperty('d');
        }
    }
    return {
        strokeColor: color,
        strokeWeight: 2,
        strokeOpacity: 0.75
    }
}

var scoreTypes = ['day', 'night'];
var scoreDetails = {
    '3' : {'panel': 'panel-success', 'info': 'Looks Pretty Safe'},
    '2' : {'panel': 'panel-warning', 'info': 'Looks OK'},
    '1' : {'panel': 'panel-danger', 'info': 'Looks Dangerous'}
};

function scoreWalkingDirections(path) {
    $('#safety-score-modal').show();
    $('#safety-score-loading').show();
    $('#safety-score-result').hide();

    coordinates = [];
    for(var i=0; i<path.length; i++) {
        coordinates.push({lat: path[i].G, lon: path[i].K})
    }
    $.post('https://polar-oasis-3769.herokuapp.com/score',
        JSON.stringify(coordinates),
        processWalkingDirectionsScore);
}

function processWalkingDirectionsScore(result) {
    result = $.parseJSON(result);
    console.log(result);
    $.each(scoreTypes, function() {
        var scoreType = this;
        var score = '' + Math.round(result.scores[scoreType]);
        var detail = scoreDetails[score];
        var id = '#safety-score-result-' + scoreType;

        $(id).removeClass().addClass('panel ' + detail.panel);
        $(id + ' .safety-info').html(detail.info);
    });
    
    $('#safety-score-modal').show();
    $('#safety-score-loading').hide();
    $('#safety-score-result').show();
}

function onBackKeyDown(e) {
    //if no mod
    /*if (($("#myModal").data('bs.modal')).isShown) {
        e.preventDefault();
        $('#myModal').modal('hide');
    }*/
    e.preventDefault();
    if ($('.menu-modal').is(':visible')) {
        $('.menu-modal').modal('hide');
    } else {
        navigator.app.exitApp();
    }
}
