
(function ($) {
  'use strict';
  if (typeof wpcf7 === 'undefined' || wpcf7 === null) {
    return
  }
  wpcf7 = $.extend({
    cached: 0,
    inputs: []
  }, wpcf7);
  $(function () {
    wpcf7.supportHtml5 = (function () {
      var features = {};
      var input = document.createElement('input');
      features.placeholder = 'placeholder' in input;
      var inputTypes = ['email', 'url', 'tel', 'number', 'range', 'date'];
      $.each(inputTypes, function (index, value) {
        input.setAttribute('type', value);
        features[value] = input.type !== 'text'
      });
      return features
    })();
    $('div.wpcf7 > form').each(function () {
      var $form = $(this);
      wpcf7.initForm($form);
      if (wpcf7.cached) {
        wpcf7.refill($form)
      }
    })
  });
  wpcf7.getId = function (form) {
    return parseInt($('input[name="_wpcf7"]', form).val(), 10)
  };
  wpcf7.initForm = function (form) {
    var $form = $(form);
    wpcf7.setStatus($form, 'init');
    $form.submit(function (event) {
      if (!wpcf7.supportHtml5.placeholder) {
        $('[placeholder].placeheld', $form).each(function (i, n) {
          $(n).val('').removeClass('placeheld')
        })
      }
      if (typeof window.FormData === 'function') {
        wpcf7.submit($form);
        event.preventDefault()
      }
    });
    $('.wpcf7-submit', $form).after('<span class="ajax-loader"></span>');
    wpcf7.toggleSubmit($form);
    $form.on('click', '.wpcf7-acceptance', function () {
      wpcf7.toggleSubmit($form)
    });
    $('.wpcf7-exclusive-checkbox', $form).on('click', 'input:checkbox', function () {
      var name = $(this).attr('name');
      $form.find('input:checkbox[name="' + name + '"]').not(this).prop('checked', !1)
    });
    $('.wpcf7-list-item.has-free-text', $form).each(function () {
      var $freetext = $(':input.wpcf7-free-text', this);
      var $wrap = $(this).closest('.wpcf7-form-control');
      if ($(':checkbox, :radio', this).is(':checked')) {
        $freetext.prop('disabled', !1)
      } else {
        $freetext.prop('disabled', !0)
      }
      $wrap.on('change', ':checkbox, :radio', function () {
        var $cb = $('.has-free-text', $wrap).find(':checkbox, :radio');
        if ($cb.is(':checked')) {
          $freetext.prop('disabled', !1).focus()
        } else {
          $freetext.prop('disabled', !0)
        }
      })
    });
    if (!wpcf7.supportHtml5.placeholder) {
      $('[placeholder]', $form).each(function () {
        $(this).val($(this).attr('placeholder'));
        $(this).addClass('placeheld');
        $(this).focus(function () {
          if ($(this).hasClass('placeheld')) {
            $(this).val('').removeClass('placeheld')
          }
        });
        $(this).blur(function () {
          if ('' === $(this).val()) {
            $(this).val($(this).attr('placeholder'));
            $(this).addClass('placeheld')
          }
        })
      })
    }
    if (wpcf7.jqueryUi && !wpcf7.supportHtml5.date) {
      $form.find('input.wpcf7-date[type="date"]').each(function () {
        $(this).datepicker({
          dateFormat: 'yy-mm-dd',
          minDate: new Date($(this).attr('min')),
          maxDate: new Date($(this).attr('max'))
        })
      })
    }
    if (wpcf7.jqueryUi && !wpcf7.supportHtml5.number) {
      $form.find('input.wpcf7-number[type="number"]').each(function () {
        $(this).spinner({
          min: $(this).attr('min'),
          max: $(this).attr('max'),
          step: $(this).attr('step')
        })
      })
    }
    wpcf7.resetCounter($form);
    $form.on('change', '.wpcf7-validates-as-url', function () {
      var val = $.trim($(this).val());
      if (val && !val.match(/^[a-z][a-z0-9.+-]*:/i) && -1 !== val.indexOf('.')) {
        val = val.replace(/^\/+/, '');
        val = 'http://' + val
      }
      $(this).val(val)
    })
  };
  wpcf7.submit = function (form) {
    if (typeof window.FormData !== 'function') {
      return
    }
    var $form = $(form);
    $('.ajax-loader', $form).addClass('is-active');
    wpcf7.clearResponse($form);
    var formData = new FormData($form.get(0));
    var detail = {
      id: $form.closest('div.wpcf7').attr('id'),
      status: 'init',
      inputs: [],
      formData: formData
    };
    $.each($form.serializeArray(), function (i, field) {
      if ('_wpcf7' == field.name) {
        detail.contactFormId = field.value
      } else if ('_wpcf7_version' == field.name) {
        detail.pluginVersion = field.value
      } else if ('_wpcf7_locale' == field.name) {
        detail.contactFormLocale = field.value
      } else if ('_wpcf7_unit_tag' == field.name) {
        detail.unitTag = field.value
      } else if ('_wpcf7_container_post' == field.name) {
        detail.containerPostId = field.value
      } else if (field.name.match(/^_/)) { } else {
        detail.inputs.push(field)
      }
    });
    wpcf7.triggerEvent($form.closest('div.wpcf7'), 'beforesubmit', detail);
    var ajaxSuccess = function (data, status, xhr, $form) {
      detail.id = $(data.into).attr('id');
      detail.status = data.status;
      detail.apiResponse = data;
      switch (data.status) {
        case 'init':
          wpcf7.setStatus($form, 'init');
          break;
        case 'validation_failed':
          $.each(data.invalid_fields, function (i, n) {
            $(n.into, $form).each(function () {
              wpcf7.notValidTip(this, n.message);
              $('.wpcf7-form-control', this).addClass('wpcf7-not-valid');
              $('.wpcf7-form-control', this).attr('aria-describedby', n.error_id);
              $('[aria-invalid]', this).attr('aria-invalid', 'true')
            })
          });
          wpcf7.setStatus($form, 'invalid');
          wpcf7.triggerEvent(data.into, 'invalid', detail);
          break;
        case 'acceptance_missing':
          wpcf7.setStatus($form, 'unaccepted');
          wpcf7.triggerEvent(data.into, 'unaccepted', detail);
          break;
        case 'spam':
          wpcf7.setStatus($form, 'spam');
          wpcf7.triggerEvent(data.into, 'spam', detail);
          break;
        case 'aborted':
          wpcf7.setStatus($form, 'aborted');
          wpcf7.triggerEvent(data.into, 'aborted', detail);
          break;
        case 'mail_sent':
          wpcf7.setStatus($form, 'sent');
          wpcf7.triggerEvent(data.into, 'mailsent', detail);
          break;
        case 'mail_failed':
          wpcf7.setStatus($form, 'failed');
          wpcf7.triggerEvent(data.into, 'mailfailed', detail);
          break;
        default:
          wpcf7.setStatus($form, 'custom-' + data.status.replace(/[^0-9a-z]+/i, '-'))
      }
      wpcf7.refill($form, data);
      wpcf7.triggerEvent(data.into, 'submit', detail);
      if ('mail_sent' == data.status) {
        $form.each(function () {
          this.reset()
        });
        wpcf7.toggleSubmit($form);
        wpcf7.resetCounter($form)
      }
      if (!wpcf7.supportHtml5.placeholder) {
        $form.find('[placeholder].placeheld').each(function (i, n) {
          $(n).val($(n).attr('placeholder'))
        })
      }
      $('.wpcf7-response-output', $form).html('').append(data.message).slideDown('fast');
      $('.screen-reader-response', $form.closest('.wpcf7')).each(function () {
        var $response = $(this);
        $('[role="status"]', $response).html(data.message);
        if (data.invalid_fields) {
          $.each(data.invalid_fields, function (i, n) {
            if (n.idref) {
              var $li = $('<li></li>').append($('<a></a>').attr('href', '#' + n.idref).append(n.message))
            } else {
              var $li = $('<li></li>').append(n.message)
            }
            $li.attr('id', n.error_id);
            $('ul', $response).append($li)
          })
        }
      });
      if (data.posted_data_hash) {
        $form.find('input[name="_wpcf7_posted_data_hash"]').first().val(data.posted_data_hash)
      }
    };
    $.ajax({
      type: 'POST',
      url: wpcf7.apiSettings.getRoute('/contact-forms/' + wpcf7.getId($form) + '/feedback'),
      data: formData,
      dataType: 'json',
      processData: !1,
      contentType: !1
    }).done(function (data, status, xhr) {
      ajaxSuccess(data, status, xhr, $form);
      $('.ajax-loader', $form).removeClass('is-active')
    }).fail(function (xhr, status, error) {
      var $e = $('<div class="ajax-error"></div>').text(error.message);
      $form.after($e)
    })
  };
  wpcf7.triggerEvent = function (target, name, detail) {
    var event = new CustomEvent('wpcf7' + name, {
      bubbles: !0,
      detail: detail
    });
    $(target).get(0).dispatchEvent(event)
  };
  wpcf7.setStatus = function (form, status) {
    var $form = $(form);
    var prevStatus = $form.attr('data-status');
    $form.data('status', status);
    $form.addClass(status);
    $form.attr('data-status', status);
    if (prevStatus && prevStatus !== status) {
      $form.removeClass(prevStatus)
    }
  }
  wpcf7.toggleSubmit = function (form, state) {
    var $form = $(form);
    var $submit = $('input:submit', $form);
    if (typeof state !== 'undefined') {
      $submit.prop('disabled', !state);
      return
    }
    if ($form.hasClass('wpcf7-acceptance-as-validation')) {
      return
    }
    $submit.prop('disabled', !1);
    $('.wpcf7-acceptance', $form).each(function () {
      var $span = $(this);
      var $input = $('input:checkbox', $span);
      if (!$span.hasClass('optional')) {
        if ($span.hasClass('invert') && $input.is(':checked') || !$span.hasClass('invert') && !$input.is(':checked')) {
          $submit.prop('disabled', !0);
          return !1
        }
      }
    })
  };
  wpcf7.resetCounter = function (form) {
    var $form = $(form);
    $('.wpcf7-character-count', $form).each(function () {
      var $count = $(this);
      var name = $count.attr('data-target-name');
      var down = $count.hasClass('down');
      var starting = parseInt($count.attr('data-starting-value'), 10);
      var maximum = parseInt($count.attr('data-maximum-value'), 10);
      var minimum = parseInt($count.attr('data-minimum-value'), 10);
      var updateCount = function (target) {
        var $target = $(target);
        var length = $target.val().length;
        var count = down ? starting - length : length;
        $count.attr('data-current-value', count);
        $count.text(count);
        if (maximum && maximum < length) {
          $count.addClass('too-long')
        } else {
          $count.removeClass('too-long')
        }
        if (minimum && length < minimum) {
          $count.addClass('too-short')
        } else {
          $count.removeClass('too-short')
        }
      };
      $(':input[name="' + name + '"]', $form).each(function () {
        updateCount(this);
        $(this).keyup(function () {
          updateCount(this)
        })
      })
    })
  };
  wpcf7.notValidTip = function (target, message) {
    var $target = $(target);
    $('.wpcf7-not-valid-tip', $target).remove();
    $('<span></span>').attr({
      'class': 'wpcf7-not-valid-tip',
      'aria-hidden': 'true',
    }).text(message).appendTo($target);
    if ($target.is('.use-floating-validation-tip *')) {
      var fadeOut = function (target) {
        $(target).not(':hidden').animate({
          opacity: 0
        }, 'fast', function () {
          $(this).css({
            'z-index': -100
          })
        })
      };
      $target.on('mouseover', '.wpcf7-not-valid-tip', function () {
        fadeOut(this)
      });
      $target.on('focus', ':input', function () {
        fadeOut($('.wpcf7-not-valid-tip', $target))
      })
    }
  };
  wpcf7.refill = function (form, data) {
    var $form = $(form);
    var refillCaptcha = function ($form, items) {
      $.each(items, function (i, n) {
        $form.find(':input[name="' + i + '"]').val('');
        $form.find('img.wpcf7-captcha-' + i).attr('src', n);
        var match = /([0-9]+)\.(png|gif|jpeg)$/.exec(n);
        $form.find('input:hidden[name="_wpcf7_captcha_challenge_' + i + '"]').attr('value', match[1])
      })
    };
    var refillQuiz = function ($form, items) {
      $.each(items, function (i, n) {
        $form.find(':input[name="' + i + '"]').val('');
        $form.find(':input[name="' + i + '"]').siblings('span.wpcf7-quiz-label').text(n[0]);
        $form.find('input:hidden[name="_wpcf7_quiz_answer_' + i + '"]').attr('value', n[1])
      })
    };
    if (typeof data === 'undefined') {
      $.ajax({
        type: 'GET',
        url: wpcf7.apiSettings.getRoute('/contact-forms/' + wpcf7.getId($form) + '/refill'),
        beforeSend: function (xhr) {
          var nonce = $form.find(':input[name="_wpnonce"]').val();
          if (nonce) {
            xhr.setRequestHeader('X-WP-Nonce', nonce)
          }
        },
        dataType: 'json'
      }).done(function (data, status, xhr) {
        if (data.captcha) {
          refillCaptcha($form, data.captcha)
        }
        if (data.quiz) {
          refillQuiz($form, data.quiz)
        }
      })
    } else {
      if (data.captcha) {
        refillCaptcha($form, data.captcha)
      }
      if (data.quiz) {
        refillQuiz($form, data.quiz)
      }
    }
  };
  wpcf7.clearResponse = function (form) {
    var $form = $(form);
    $form.siblings('.screen-reader-response').each(function () {
      $('[role="status"]', this).html('');
      $('ul', this).html('')
    });
    $('.wpcf7-not-valid-tip', $form).remove();
    $('[aria-invalid]', $form).attr('aria-invalid', 'false');
    $('.wpcf7-form-control', $form).removeClass('wpcf7-not-valid');
    $('.wpcf7-response-output', $form).hide().empty()
  };
  wpcf7.apiSettings.getRoute = function (path) {
    var url = wpcf7.apiSettings.root;
    url = url.replace(wpcf7.apiSettings.namespace, wpcf7.apiSettings.namespace + path);
    return url
  }
})(jQuery);
(function () {
  if (typeof window.CustomEvent === "function") return !1;

  function CustomEvent(event, params) {
    params = params || {
      bubbles: !1,
      cancelable: !1,
      detail: undefined
    };
    var evt = document.createEvent('CustomEvent');
    evt.initCustomEvent(event, params.bubbles, params.cancelable, params.detail);
    return evt
  }
  CustomEvent.prototype = window.Event.prototype;
  window.CustomEvent = CustomEvent
})(); /*! This file is auto-generated */
window.addComment = function (f) {
  var v, I, C, h = f.document,
    E = {
      commentReplyClass: "comment-reply-link",
      commentReplyTitleId: "reply-title",
      cancelReplyId: "cancel-comment-reply-link",
      commentFormId: "commentform",
      temporaryFormId: "wp-temp-form-div",
      parentIdFieldId: "comment_parent",
      postIdFieldId: "comment_post_ID"
    },
    e = f.MutationObserver || f.WebKitMutationObserver || f.MozMutationObserver,
    i = "querySelector" in h && "addEventListener" in f,
    n = !!h.documentElement.dataset;

  function t() {
    d(),
      function () {
        if (!e) return;
        new e(o).observe(h.body, {
          childList: !0,
          subtree: !0
        })
      }()
  }

  function d(e) {
    if (i && (v = b(E.cancelReplyId), I = b(E.commentFormId), v)) {
      v.addEventListener("touchstart", l), v.addEventListener("click", l);
      var t = function (e) {
        if ((e.metaKey || e.ctrlKey) && 13 === e.keyCode) return I.removeEventListener("keydown", t), e.preventDefault(), I.submit.click(), !1
      };
      I && I.addEventListener("keydown", t);
      for (var n, d = function (e) {
        var t, n = E.commentReplyClass;
        e && e.childNodes || (e = h);
        t = h.getElementsByClassName ? e.getElementsByClassName(n) : e.querySelectorAll("." + n);
        return t
      }(e), o = 0, r = d.length; o < r; o++)(n = d[o]).addEventListener("touchstart", a), n.addEventListener("click", a)
    }
  }

  function l(e) {
    var t = b(E.temporaryFormId);
    if (t && C) {
      b(E.parentIdFieldId).value = "0";
      var n = t.textContent;
      t.parentNode.replaceChild(C, t), this.style.display = "none";
      var d = b(E.commentReplyTitleId),
        o = d && d.firstChild,
        r = o && o.nextSibling;
      o && o.nodeType === Node.TEXT_NODE && n && (r && "A" === r.nodeName && r.id !== E.cancelReplyId && (r.style.display = ""), o.textContent = n), e.preventDefault()
    }
  }

  function a(e) {
    var t = b(E.commentReplyTitleId),
      n = t && t.firstChild.textContent,
      d = this,
      o = m(d, "belowelement"),
      r = m(d, "commentid"),
      i = m(d, "respondelement"),
      l = m(d, "postid"),
      a = m(d, "replyto") || n;
    o && r && i && l && !1 === f.addComment.moveForm(o, r, i, l, a) && e.preventDefault()
  }

  function o(e) {
    for (var t = e.length; t--;)
      if (e[t].addedNodes.length) return void d()
  }

  function m(e, t) {
    return n ? e.dataset[t] : e.getAttribute("data-" + t)
  }

  function b(e) {
    return h.getElementById(e)
  }
  return i && "loading" !== h.readyState ? t() : i && f.addEventListener("DOMContentLoaded", t, !1), {
    init: d,
    moveForm: function (e, t, n, d, o) {
      var r = b(e);
      C = b(n);
      var i, l, a, m = b(E.parentIdFieldId),
        c = b(E.postIdFieldId),
        s = b(E.commentReplyTitleId),
        y = s && s.firstChild,
        u = y && y.nextSibling;
      if (r && C && m) {
        void 0 === o && (o = y && y.textContent),
          function (e) {
            var t = E.temporaryFormId,
              n = b(t),
              d = b(E.commentReplyTitleId),
              o = d ? d.firstChild.textContent : "";
            if (n) return;
            (n = h.createElement("div")).id = t, n.style.display = "none", n.textContent = o, e.parentNode.insertBefore(n, e)
          }(C), d && c && (c.value = d), m.value = t, v.style.display = "", r.parentNode.insertBefore(C, r.nextSibling), y && y.nodeType === Node.TEXT_NODE && (u && "A" === u.nodeName && u.id !== E.cancelReplyId && (u.style.display = "none"), y.textContent = o), v.onclick = function () {
            return !1
          };
        try {
          for (var p = 0; p < I.elements.length; p++)
            if (i = I.elements[p], l = !1, "getComputedStyle" in f ? a = f.getComputedStyle(i) : h.documentElement.currentStyle && (a = i.currentStyle), (i.offsetWidth <= 0 && i.offsetHeight <= 0 || "hidden" === a.visibility) && (l = !0), "hidden" !== i.type && !i.disabled && !l) {
              i.focus();
              break
            }
        } catch (e) { }
        return !1
      }
    }
  }
}(window);
/*!
 * Plugin: jQuery Parallax
 * Version 1.1.3
 * Plugin URL: http://www.ianlunn.co.uk/plugins/jquery-parallax/
 */
! function (a) {
  var b = a(window),
    c = b.height();
  b.resize(function () {
    c = b.height()
  }), a.fn.parallax = function (d, e, f) {
    function k() {
      var f = b.scrollTop();
      g.each(function () {
        var b = a(this),
          j = b.offset().top,
          k = h(b);
        j + k < f || j > f + c || g.css("backgroundPosition", d + " " + Math.round((i - f) * e) + "px")
      })
    }
    var h, i, g = a(this);
    g.each(function () {
      i = g.offset().top
    }), h = f ? function (a) {
      return a.outerHeight(!0)
    } : function (a) {
      return a.height()
    }, (arguments.length < 1 || null === d) && (d = "50%"), (arguments.length < 2 || null === e) && (e = .1), (arguments.length < 3 || null === f) && (f = !0), b.bind("scroll", k).resize(k), k()
  }
}(jQuery);
/*! formstone v0.8.19 [core.js] 2015-09-29 | MIT License | formstone.it */
var Formstone = window.Formstone = function (a, b, c) {
  "use strict";

  function d(a) {
    m.Plugins[a].initialized || (m.Plugins[a].methods._setup.call(c), m.Plugins[a].initialized = !0)
  }

  function e(a, b, c, d) {
    var e, f = {
      raw: {}
    };
    d = d || {};
    for (e in d) d.hasOwnProperty(e) && ("classes" === a ? (f.raw[d[e]] = b + "-" + d[e], f[d[e]] = "." + b + "-" + d[e]) : (f.raw[e] = d[e], f[e] = d[e] + "." + b));
    for (e in c) c.hasOwnProperty(e) && ("classes" === a ? (f.raw[e] = c[e].replace(/{ns}/g, b), f[e] = c[e].replace(/{ns}/g, "." + b)) : (f.raw[e] = c[e].replace(/.{ns}/g, ""), f[e] = c[e].replace(/{ns}/g, b)));
    return f
  }

  function f() {
    var a, b = {
      transition: "transitionend",
      MozTransition: "transitionend",
      OTransition: "otransitionend",
      WebkitTransition: "webkitTransitionEnd"
    },
      d = ["transition", "-webkit-transition"],
      e = {
        transform: "transform",
        MozTransform: "-moz-transform",
        OTransform: "-o-transform",
        msTransform: "-ms-transform",
        webkitTransform: "-webkit-transform"
      },
      f = "transitionend",
      g = "",
      h = "",
      i = c.createElement("div");
    for (a in b)
      if (b.hasOwnProperty(a) && a in i.style) {
        f = b[a], m.support.transition = !0;
        break
      }
    p.transitionEnd = f + ".{ns}";
    for (a in d)
      if (d.hasOwnProperty(a) && d[a] in i.style) {
        g = d[a];
        break
      }
    m.transition = g;
    for (a in e)
      if (e.hasOwnProperty(a) && e[a] in i.style) {
        m.support.transform = !0, h = e[a];
        break
      }
    m.transform = h
  }

  function g() {
    m.windowWidth = m.$window.width(), m.windowHeight = m.$window.height(), q = l.startTimer(q, r, h)
  }

  function h() {
    for (var a in m.ResizeHandlers) m.ResizeHandlers.hasOwnProperty(a) && m.ResizeHandlers[a].callback.call(b, m.windowWidth, m.windowHeight)
  }

  function i() {
    if (m.support.raf) {
      m.window.requestAnimationFrame(i);
      for (var a in m.RAFHandlers) m.RAFHandlers.hasOwnProperty(a) && m.RAFHandlers[a].callback.call(b)
    }
  }

  function j(a, b) {
    return parseInt(a.priority) - parseInt(b.priority)
  }
  var k = function () {
    this.Version = "0.8.19", this.Plugins = {}, this.DontConflict = !1, this.Conflicts = {
      fn: {}
    }, this.ResizeHandlers = [], this.RAFHandlers = [], this.window = b, this.$window = a(b), this.document = c, this.$document = a(c), this.$body = null, this.windowWidth = 0, this.windowHeight = 0, this.userAgent = b.navigator.userAgent || b.navigator.vendor || b.opera, this.isFirefox = /Firefox/i.test(this.userAgent), this.isChrome = /Chrome/i.test(this.userAgent), this.isSafari = /Safari/i.test(this.userAgent) && !this.isChrome, this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(this.userAgent), this.isFirefoxMobile = this.isFirefox && this.isMobile, this.transform = null, this.transition = null, this.support = {
      file: !!(b.File && b.FileList && b.FileReader),
      history: !!(b.history && b.history.pushState && b.history.replaceState),
      matchMedia: !(!b.matchMedia && !b.msMatchMedia),
      pointer: !!b.PointerEvent,
      raf: !(!b.requestAnimationFrame || !b.cancelAnimationFrame),
      touch: !!("ontouchstart" in b || b.DocumentTouch && c instanceof b.DocumentTouch),
      transition: !1,
      transform: !1
    }
  },
    l = {
      killEvent: function (a, b) {
        try {
          a.preventDefault(), a.stopPropagation(), b && a.stopImmediatePropagation()
        } catch (c) { }
      },
      startTimer: function (a, b, c, d) {
        return l.clearTimer(a), d ? setInterval(c, b) : setTimeout(c, b)
      },
      clearTimer: function (a, b) {
        a && (b ? clearInterval(a) : clearTimeout(a), a = null)
      },
      sortAsc: function (a, b) {
        return parseInt(a, 10) - parseInt(b, 10)
      },
      sortDesc: function (a, b) {
        return parseInt(b, 10) - parseInt(a, 10)
      }
    },
    m = new k,
    n = a.Deferred(),
    o = {
      base: "{ns}",
      element: "{ns}-element"
    },
    p = {
      namespace: ".{ns}",
      beforeUnload: "beforeunload.{ns}",
      blur: "blur.{ns}",
      change: "change.{ns}",
      click: "click.{ns}",
      dblClick: "dblclick.{ns}",
      drag: "drag.{ns}",
      dragEnd: "dragend.{ns}",
      dragEnter: "dragenter.{ns}",
      dragLeave: "dragleave.{ns}",
      dragOver: "dragover.{ns}",
      dragStart: "dragstart.{ns}",
      drop: "drop.{ns}",
      error: "error.{ns}",
      focus: "focus.{ns}",
      focusIn: "focusin.{ns}",
      focusOut: "focusout.{ns}",
      input: "input.{ns}",
      keyDown: "keydown.{ns}",
      keyPress: "keypress.{ns}",
      keyUp: "keyup.{ns}",
      load: "load.{ns}",
      mouseDown: "mousedown.{ns}",
      mouseEnter: "mouseenter.{ns}",
      mouseLeave: "mouseleave.{ns}",
      mouseMove: "mousemove.{ns}",
      mouseOut: "mouseout.{ns}",
      mouseOver: "mouseover.{ns}",
      mouseUp: "mouseup.{ns}",
      panStart: "panstart.{ns}",
      pan: "pan.{ns}",
      panEnd: "panend.{ns}",
      resize: "resize.{ns}",
      scaleStart: "scalestart.{ns}",
      scaleEnd: "scaleend.{ns}",
      scale: "scale.{ns}",
      scroll: "scroll.{ns}",
      select: "select.{ns}",
      swipe: "swipe.{ns}",
      touchCancel: "touchcancel.{ns}",
      touchEnd: "touchend.{ns}",
      touchLeave: "touchleave.{ns}",
      touchMove: "touchmove.{ns}",
      touchStart: "touchstart.{ns}"
    };
  k.prototype.NoConflict = function () {
    m.DontConflict = !0;
    for (var b in m.Plugins) m.Plugins.hasOwnProperty(b) && (a[b] = m.Conflicts[b], a.fn[b] = m.Conflicts.fn[b])
  }, k.prototype.Plugin = function (c, f) {
    return m.Plugins[c] = function (c, d) {
      function f(b) {
        var e, f, g, i = "object" === a.type(b),
          j = this,
          k = a();
        for (b = a.extend(!0, {}, d.defaults || {}, i ? b : {}), f = 0, g = j.length; g > f; f++)
          if (e = j.eq(f), !h(e)) {
            var l = "__" + d.guid++,
              m = d.classes.raw.base + l,
              n = e.data(c + "-options"),
              o = a.extend(!0, {
                $el: e,
                guid: l,
                rawGuid: m,
                dotGuid: "." + m
              }, b, "object" === a.type(n) ? n : {});
            e.addClass(d.classes.raw.element).data(s, o), d.methods._construct.apply(e, [o].concat(Array.prototype.slice.call(arguments, i ? 1 : 0))), k = k.add(e)
          }
        for (f = 0, g = k.length; g > f; f++) e = k.eq(f), d.methods._postConstruct.apply(e, [h(e)]);
        return j
      }

      function g() {
        d.functions.iterate.apply(this, [d.methods._destruct].concat(Array.prototype.slice.call(arguments, 1))), this.removeClass(d.classes.raw.element).removeData(s)
      }

      function h(a) {
        return a.data(s)
      }

      function i(b) {
        if (this instanceof a) {
          var c = d.methods[b];
          return "object" !== a.type(b) && b ? c && 0 !== b.indexOf("_") ? d.functions.iterate.apply(this, [c].concat(Array.prototype.slice.call(arguments, 1))) : this : f.apply(this, arguments)
        }
      }

      function k(c) {
        var e = d.utilities[c] || d.utilities._initialize || !1;
        return e ? e.apply(b, Array.prototype.slice.call(arguments, "object" === a.type(c) ? 0 : 1)) : void 0
      }

      function n(b) {
        d.defaults = a.extend(!0, d.defaults, b || {})
      }

      function q(b) {
        for (var c = this, d = 0, e = c.length; e > d; d++) {
          var f = c.eq(d),
            g = h(f) || {};
          "undefined" !== a.type(g.$el) && b.apply(f, [g].concat(Array.prototype.slice.call(arguments, 1)))
        }
        return c
      }
      var r = "fs-" + c,
        s = "fs" + c.replace(/(^|\s)([a-z])/g, function (a, b, c) {
          return b + c.toUpperCase()
        });
      return d.initialized = !1, d.priority = d.priority || 10, d.classes = e("classes", r, o, d.classes), d.events = e("events", c, p, d.events), d.functions = a.extend({
        getData: h,
        iterate: q
      }, l, d.functions), d.methods = a.extend(!0, {
        _setup: a.noop,
        _construct: a.noop,
        _postConstruct: a.noop,
        _destruct: a.noop,
        _resize: !1,
        destroy: g
      }, d.methods), d.utilities = a.extend(!0, {
        _initialize: !1,
        _delegate: !1,
        defaults: n
      }, d.utilities), d.widget && (m.Conflicts.fn[c] = a.fn[c], a.fn[s] = i, m.DontConflict || (a.fn[c] = a.fn[s])), m.Conflicts[c] = a[c], a[s] = d.utilities._delegate || k, m.DontConflict || (a[c] = a[s]), d.namespace = c, d.namespaceClean = s, d.guid = 0, d.methods._resize && (m.ResizeHandlers.push({
        namespace: c,
        priority: d.priority,
        callback: d.methods._resize
      }), m.ResizeHandlers.sort(j)), d.methods._raf && (m.RAFHandlers.push({
        namespace: c,
        priority: d.priority,
        callback: d.methods._raf
      }), m.RAFHandlers.sort(j)), d
    }(c, f), n.then(function () {
      d(c)
    }), m.Plugins[c]
  };
  var q = null,
    r = 20;
  return m.$window.on("resize.fs", g), g(), i(), a(function () {
    m.$body = a("body"), n.resolve()
  }), p.clickTouchStart = p.click + " " + p.touchStart, f(), m
}(jQuery, window, document);
/*! formstone v0.8.19 [number.js] 2015-09-29 | MIT License | formstone.it */
! function (a, b) {
  "use strict";

  function c() {
    s = b.$body
  }

  function d(a) {
    var b = parseFloat(this.attr("min")),
      c = parseFloat(this.attr("max"));
    a.min = b || 0 === b ? b : !1, a.max = c || 0 === c ? c : !1, a.step = parseFloat(this.attr("step")) || 1, a.timer = null, a.digits = l(a.step), a.disabled = this.prop("disabled");
    var d = "";
    d += '<button type="button" class="' + [p.arrow, p.up].join(" ") + '">' + a.labels.up + "</button>", d += '<button type="button" class="' + [p.arrow, p.down].join(" ") + '">' + a.labels.down + "</button>", this.wrap('<div class="' + [p.base, a.customClass, a.disabled ? p.disabled : ""].join(" ") + '"></div>').after(d), a.$container = this.parent(o.base), a.$arrows = a.$container.find(o.arrow), this.on(q.keyPress, o.element, a, h), a.$container.on([q.touchStart, q.mouseDown].join(" "), o.arrow, a, i)
  }

  function e(a) {
    a.$arrows.remove(), this.unwrap().off(q.namespace)
  }

  function f(a) {
    a.disabled && (this.prop("disabled", !1), a.$container.removeClass(p.disabled), a.disabled = !1)
  }

  function g(a) {
    a.disabled || (this.prop("disabled", !0), a.$container.addClass(p.disabled), a.disabled = !0)
  }

  function h(a) {
    var b = a.data;
    (38 === a.keyCode || 40 === a.keyCode) && (a.preventDefault(), k(b, 38 === a.keyCode ? b.step : -b.step))
  }

  function i(b) {
    r.killEvent(b), j(b);
    var c = b.data;
    if (!c.disabled) {
      var d = a(b.target).hasClass(p.up) ? c.step : -c.step;
      c.timer = r.startTimer(c.timer, 110, function () {
        k(c, d, !1)
      }, !0), k(c, d), s.on([q.touchEnd, q.mouseUp].join(" "), c, j)
    }
  }

  function j(a) {
    r.killEvent(a);
    var b = a.data;
    r.clearTimer(b.timer, !0), s.off(q.namespace)
  }

  function k(b, c) {
    var d = parseFloat(b.$el.val()),
      e = c;
    "undefined" === a.type(d) || isNaN(d) ? e = b.min !== !1 ? b.min : 0 : b.min !== !1 && d < b.min ? e = b.min : e += d;
    var f = (e - b.min) % b.step;
    0 !== f && (e -= f), b.min !== !1 && e < b.min && (e = b.min), b.max !== !1 && e > b.max && (e -= b.step), e !== d && (e = m(e, b.digits), b.$el.val(e).trigger(q.raw.change))
  }

  function l(a) {
    var b = String(a);
    return b.indexOf(".") > -1 ? b.length - b.indexOf(".") - 1 : 0
  }

  function m(a, b) {
    var c = Math.pow(10, b);
    return Math.round(a * c) / c
  }
  var n = b.Plugin("number", {
    widget: !0,
    defaults: {
      customClass: "",
      labels: {
        up: "Up",
        down: "Down"
      }
    },
    classes: ["arrow", "up", "down", "disabled"],
    methods: {
      _setup: c,
      _construct: d,
      _destruct: e,
      enable: f,
      disable: g
    },
    events: {}
  }),
    o = n.classes,
    p = o.raw,
    q = n.events,
    r = n.functions,
    s = null
}(jQuery, Formstone);
(function ($) {
  'use strict';
  $(window).on('load', function () {
    isotopMsSetup();
    preloader();
    youtubePlaylist();
    onePage()
  });
  $(document).on('qv_loader_stop', function () {
    qtyStepper()
  });
  $(document).on('ready', function () {
    scrollUp();
    browserCompatible();
    primaryMenuSetup();
    lightGallery();
    $(window).trigger('resize');
    elementornegativeMargin();
    mobileMenu();
    isotopMsSetup();
    pageHeightOf404();
    swiperSlider();
    accordianSetup();
    modalVideo();
    tabs();
    modal();
    customSelectSetup();
    customQuantity();
    lineChart();
    roundChart();
    countDown();
    horizontalProgressBar();
    stickyFooter();
    beforeAfterSlider();
    googleMap();
    postVoteCount();
    tbSvgShape();
    appleTVeffect();
    qtyStepper();
    ajaxPagination();
    onePage();
    foodMenuList();
    parallax();
    searchModal();
    audioPlayerSetup();
    sectionScroll();
    zoomEffect();
    datePickerSetup();
    cursorPlus()
  });
  $(window).on('resize', function () {
    mobileMenu();
    isotopMsSetup();
    pageHeightOf404();
    stickyFooter();
    beforeAfterSlider()
  });
  $(window).on('scroll', function () {
    scrollFunction();
    horizontalProgressBar();
    stickyFooter()
  });
  $.exists = function (selector) {
    return ($(selector).length > 0)
  }

  function preloader() {
    $(".preloader-in").fadeOut();
    $(".preloader").delay(150).fadeOut("slow")
  }

  function browserCompatible() { }

  function scrollUp() {
    $('#scrollup').on('click', function (e) {
      e.preventDefault();
      $('html,body').animate({
        scrollTop: 0
      }, 1000)
    })
  }

  function elementornegativeMargin() {
    $('.elementor-spacer-inner').parents('.elementor-row').addClass('removeNegativeMargin')
  }

  function primaryMenuSetup() {
    $('.main-nav').before('<div class="m-menu-btn"><span></span></div>');
    $('.m-menu-btn').on('click', function () {
      $(this).toggleClass('m-menu-btn-ext');
      $(this).siblings('.main-nav').slideToggle('slow');
      $('.full-screen-nav').toggleClass('full-screen-active');
      $(this).parents('.site-header.style2.type1').toggleClass('active-sidenav')
    });
    $('.menu-item-has-children ').append('<i class="plus dropdown"></i>');
    $('.dropdown').on('click', function () {
      $(this).prev().slideToggle('slow');
      $(this).toggleClass('plus minus')
    });
    $('.mega-wrapper>li>a').removeAttr("href");
    $('.mega-wrapper>li>a').on('click', function () {
      $(this).siblings().slideToggle();
      $(this).toggleClass('megamenu-plus')
    });
    $('.solid-header.sticky-header').before('<div class="solid-header-height"></div>');
    if ($.exists('.header-style13 .promotion-bar')) {
      $('.header-style13').addClass('remove-header-padding')
    }
  }

  function mobileMenu() {
    if ($(window).width() <= 991) {
      $('.primary-nav').addClass('m-menu').removeClass('primary-nav');
      $('.profile-toggle').addClass('offset-menu')
    } else {
      $('.m-menu').addClass('primary-nav').removeClass('m-menu');
      $('.profile-toggle').removeClass('offset-menu')
    }
    var solidHeaderHight = $('.solid-header').height() + 'px';
    $('.solid-header-height').css('height', solidHeaderHight);
    var pageHeadingPad = (($('.site-header').height()) + 45) + 'px'
    $('.transparent-header+.page-heading-wrap').css('padding-top', pageHeadingPad);
    var reduseSolidHeaderHight = (($('.solid-header').height()) - ($('.promotion-bar').height())) + 'px';
    var redusePageHeadingPad = (($('.site-header').height()) - ($('.promotion-bar').height()) + 45) + 'px';
    $('.promotion-cross').on('click', function () {
      $(this).parents('.promotion-bar').slideUp(400);
      $(this).parents('.site-header').siblings('.solid-header-height').css('height', reduseSolidHeaderHight);
      $(this).parents('.site-header').addClass('remove-promobar-active')
    });
    $('.transparent-header .promotion-cross').on('click', function () {
      $('.page-heading-wrap').css('padding-top', redusePageHeadingPad)
    });
    $('.site-header.style2').parents('body').addClass('sidebar-parent');
    $('.site-header.style2.type1').parents('body').addClass('sidebar-parent-small')
  }

  function scrollFunction() {
    var scroll = $(window).scrollTop();
    if (scroll >= 10) {
      $('.site-header').addClass('small-height')
    } else {
      $('.site-header').removeClass('small-height')
    }
    if (scroll >= 350) {
      $("#scrollup").addClass("scrollup-show")
    } else {
      $("#scrollup").removeClass("scrollup-show")
    }
  }

  function stickyFooter() {
    var footerHeight = ($('.sticky-footer').height());
    var windowHeight = $(window).height();
    var footerHeightPx = footerHeight + 'px';
    $('.content').css("margin-bottom", footerHeightPx);
    if (footerHeight > windowHeight) {
      $('body').addClass('remove-sticky-footer')
    }
  }

  function pageHeightOf404() {
    if ($.exists('.site-header')) {
      var headerHeight = $('.site-header').height();
      $('.error-page').css('margin-top', -headerHeight);
      $('.error-page').css('padding-top', headerHeight)
    }
  }

  function isotopMsSetup() {
    if ($.exists('.isotop')) {
      $('.isotop').isotope({
        itemSelector: '.isotop-item',
        transitionDuration: '0.60s',
        percentPosition: !0,
        masonry: {
          columnWidth: '.grid-sizer'
        }
      });
      $('.isotop-filter ul li').on('click', function (event) {
        $(this).siblings('.active').removeClass('active');
        $(this).addClass('active');
        event.preventDefault()
      });
      $('.isotop-filter ul').on('click', 'a', function () {
        var filterElement = $(this).attr('data-filter');
        $(this).parents('.isotop-filter').next().isotope({
          filter: filterElement
        })
      })
    }
  }

  function swiperSlider() {
    $('.slider').each(function () {
      var $ts = $(this).find('.slick-container');
      var $slickActive = $(this).find('.slick-wrapper');
      var autoPlayVar = parseInt($ts.attr('data-autoplay'), 10);
      var autoplaySpdVar = 3000;
      if (autoPlayVar > 1) {
        autoplaySpdVar = autoPlayVar;
        autoPlayVar = 1
      }
      var speedVar = parseInt($ts.attr('data-speed'), 10);
      var loopVar = Boolean(parseInt($ts.attr('data-loop'), 10));
      var centerVar = Boolean(parseInt($ts.attr('data-center'), 10));
      var paginaiton = $(this).children().hasClass('pagination');
      var slidesPerView = $ts.attr('data-slides-per-view');
      if (slidesPerView == 1) {
        slidesPerView = 1
      }
      if (slidesPerView == 'responsive') {
        var slidesPerView = parseInt($ts.attr('data-add-slides'), 10);
        var lgPoint = parseInt($ts.attr('data-lg-slides'), 10);
        var mdPoint = parseInt($ts.attr('data-md-slides'), 10);
        var smPoint = parseInt($ts.attr('data-sm-slides'), 10);
        var xsPoing = parseInt($ts.attr('data-xs-slides'), 10)
      }
      var fadeVar = parseInt($($ts).attr('data-fade-slide'));
      (fadeVar === 1) ? (fadeVar = !0) : (fadeVar = !1);
      $slickActive.slick({
        autoplay: autoPlayVar,
        dots: paginaiton,
        centerPadding: '0',
        speed: speedVar,
        infinite: loopVar,
        autoplaySpeed: autoplaySpdVar,
        centerMode: centerVar,
        prevArrow: $(this).find('.slick-arrow-left'),
        nextArrow: $(this).find('.slick-arrow-right'),
        appendDots: $(this).find('.pagination'),
        fade: fadeVar,
        slidesToShow: slidesPerView,
        variableWidth: !1,
        responsive: [{
          breakpoint: 1600,
          settings: {
            slidesToShow: lgPoint
          }
        }, {
          breakpoint: 1200,
          settings: {
            slidesToShow: mdPoint
          }
        }, {
          breakpoint: 992,
          settings: {
            slidesToShow: smPoint
          }
        }, {
          breakpoint: 768,
          settings: {
            slidesToShow: xsPoing
          }
        }]
      })
    })
  }

  function accordianSetup() {
    var $this = $(this);
    $('.accordian').children('.accordian-body').hide();
    $('.accordian.active').children('.accordian-body').show();
    $('.accordian-title').on('click', function () {
      $(this).parent('.accordian').siblings().children('.accordian-body').slideUp(250);
      $(this).siblings().slideDown(250);
      $(this).parents('.accordian').addClass('active');
      $(this).parent('.accordian').siblings().removeClass('active')
    })
  }

  function modalVideo() {
    $(document).on('click', '.video-open', function (e) {
      e.preventDefault();
      var video = $(this).attr('href');
      $('.video-popup-container iframe').attr('src', video);
      $('.video-popup').addClass('active')
    });
    $('.video-popup-close, .video-popup-layer').on('click', function (e) {
      $('.video-popup').removeClass('active');
      $('html').removeClass('overflow-hidden');
      $('.video-popup-container iframe').attr('src', 'about:blank')
      e.preventDefault()
    })
  }

  function tabs() {
    $('.tabs.standard-tabs .tab-links a').on('click', function (e) {
      var currentAttrValue = $(this).attr('href');
      $('.tabs ' + currentAttrValue).show().siblings().hide();
      $(this).parent('li').addClass('active').siblings().removeClass('active');
      e.preventDefault()
    });
    $('.tabs.fade-tabs .tab-links a').on('click', function (e) {
      var currentAttrValue = $(this).attr('href');
      $('.tabs ' + currentAttrValue).fadeIn(400).siblings().hide();
      $(this).parents('li').addClass('active').siblings().removeClass('active');
      e.preventDefault()
    })
  }

  function modal() {
    $('[data-modal-toggle]').on('click', function () {
      var modalToggle = $(this).data('modal-toggle');
      $('.modal').each(function () {
        var modaltarget = $(this).attr('id'),
          modalId = ('#' + modaltarget);
        if (modalToggle == modalId) {
          $(modalId).addClass('active')
        }
      })
    });
    $('.modal-dismiss').on('click', function () {
      $(this).parents('.modal').removeClass('active')
    });
    $(document).on('click', function () {
      $('.modal').removeClass('active')
    });
    $('.modal > div, [data-modal-toggle]').on('click', function (e) {
      e.stopPropagation()
    })
  }

  function customSelectSetup() {
    $('.custom-select').each(function () {
      var classes = $(this).attr('class'),
        id = $(this).attr('id'),
        name = $(this).attr('name');
      var template = '<div class="' + classes + '">';
      template += '<span class="custom-select-trigger">' + $('.custom-select-wrap > .custom-select option:first').html() + '</span>';
      template += '<div class="custom-options">';
      $(this).find('option').each(function () {
        template += '<span class="custom-option ' + $(this).attr('class') + ' data-value=' + $(this).attr('value') + '">' + $(this).html() + '</span>'
      });
      template += '</div></div>';
      $(this).wrap('<div class="custom-select-wrapper"></div>');
      $(this).hide();
      $(this).after(template)
    });
    $('.custom-select-trigger').on('click', function (event) {
      $('html').one('click', function () {
        $('.custom-select').removeClass('opened')
      });
      $(this).parents('.custom-select').toggleClass('opened');
      event.stopPropagation()
    });
    $('.custom-option').on('click', function () {
      $(this).parents('.custom-select-wrapper').find('select').val($(this).data('value'));
      $(this).siblings().removeClass('selection');
      $(this).addClass('selection');
      $(this).parent().children().first().removeClass('selection');
      $(this).parents('.custom-select').removeClass('opened');
      $(this).parent().siblings('.custom-select-trigger').addClass('selector-focus');
      $(this).parents('.custom-select').find('.custom-select-trigger').text($(this).text())
    });
    $('.custom-options .custom-option:first-child').on('click', function () {
      $(this).parent().siblings('.custom-select-trigger').removeClass('selector-focus')
    })
  }

  function lightGallery() {
    $('.lightgallery').each(function () {
      $(this).lightGallery({
        selector: '.lightbox-item',
        subHtmlSelectorRelative: !0,
      })
    })
  }

  function horizontalProgressBar() {
    $(".single-bar").each(function () {
      var progressPercentage = $(this).data("progress-percentage") + "%";
      $(this).find(".single-bar-in").css("width", progressPercentage)
    });
    $('.single-bar').each(function () {
      var windowScroll = $(document).scrollTop(),
        windowHeight = $(window).height(),
        barOffset = $(this).offset().top,
        barHeight = $(this).height(),
        barScrollUp = barOffset <= (windowScroll + windowHeight),
        barSctollDown = barOffset + barHeight >= windowScroll;
      if (barSctollDown && barScrollUp) {
        $(this).addClass('active')
      }
    })
  }

  function customQuantity() {
    $('.quantity-minus').on('click', function () {
      var $input = $(this).parent().find('input');
      if ($input.val() == '') {
        $input.val(0)
      }
      var count = parseInt($input.val()) - 1;
      count = count <= 0 ? 0 : count;
      $input.val(count);
      $input.change();
      return !1
    });
    $('.quantity-plus').on('click', function () {
      var $input = $(this).parent().find('input');
      if ($input.val() == '') {
        $input.val(0)
      }
      $input.val(parseInt($input.val()) + 1);
      $input.change();
      return !1
    })
  }

  function lineChart() {
    if ($.exists('#chart2')) {
      var selector = $('.line-chart'),
        el = selector.data('values'),
        labels = $.parseJSON(el.view_labels),
        data = $.parseJSON(el.view_data),
        y_axis_label = selector.data('y-label'),
        bg_color = selector.data('bg-color'),
        border_color = selector.data('border-color');
      var ctx = document.getElementById('chart2').getContext('2d');
      var myChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: y_axis_label,
            data: data,
            backgroundColor: bg_color,
            borderColor: border_color,
            borderWidth: 2,
            lineTension: 0,
            pointBackgroundColor: '#fff'
          }]
        },
        options: {
          responsive: !0,
          maintainAspectRatio: !1,
          legend: {
            position: 'bottom',
            display: !1
          },
          tooltips: {
            displayColors: !1,
            mode: 'nearest',
            intersect: !1,
            position: 'nearest',
            xPadding: 8,
            yPadding: 8,
            caretPadding: 8,
            backgroundColor: '#666666',
            cornerRadius: 2,
            titleFontSize: 13,
            titleFontStyle: 'normal',
            titleFontFamily: 'Open Sans',
            bodyFontSize: 13,
            footerFontFamily: 'Open Sans'
          },
          scales: {
            yAxes: [{
              ticks: {
                fontSize: 14,
                fontColor: '#b5b5b5',
                fontFamily: 'Open Sans',
                padding: 15,
                beginAtZero: !0,
                autoSkip: !1,
                maxTicksLimit: 4
              },
              gridLines: {
                color: '#d8d8d8',
                borderDash: [1, 3],
                zeroLineWidth: 1,
                zeroLineColor: '#eaeaea',
                drawBorder: !1
              }
            }],
            xAxes: [{
              ticks: {
                fontSize: 14,
                fontColor: '#b5b5b5',
                fontFamily: 'Open Sans',
                padding: 5,
                beginAtZero: !0,
                autoSkip: !1,
                maxTicksLimit: 4
              },
              gridLines: {
                color: '#d8d8d8',
                borderDash: [1, 3],
                zeroLineColor: '#b5b5b5',
              }
            }],
          },
          elements: {
            point: {
              radius: 3,
              hoverRadius: 3
            }
          }
        }
      })
    }
  }

  function roundChart() {
    if ($.exists('.round-chart')) {
      $('.round-chart').each(function () {
        var ctx = $(this).find('#chart1'),
          el = $(this),
          options = el.data('options'),
          labels = {},
          values = [],
          stroke_colors = [];
        $.each(options, function (key, value) {
          labels[key] = value.label;
          values[key] = parseInt(value.value);
          stroke_colors[key] = value.stroke_color;
          el.find('.circle-stroke .circle-label').eq(key).html(value.label).siblings().css('background-color', value.stroke_color)
        });
        var myChart = new Chart(ctx, {
          type: 'pie',
          data: {
            labels: labels,
            datasets: [{
              backgroundColor: stroke_colors,
              data: values,
              borderWidth: 0
            }]
          },
          options: {
            cutoutPercentage: 80,
            legend: {
              position: 'right',
              display: !1
            },
            tooltips: {
              displayColors: !1,
              mode: 'nearest',
              intersect: !1,
              position: 'nearest',
              xPadding: 8,
              yPadding: 8,
              caretPadding: 8,
              backgroundColor: '#666666',
              cornerRadius: 2,
              titleFontSize: 13,
              titleFontStyle: 'normal',
              titleFontFamily: 'Open Sans',
              bodyFontSize: 13,
              footerFontFamily: 'Open Sans'
            },
          }
        })
      })
    }
  }

  function countDown() {
    if ($.exists('.countdown')) {
      $('.countdown').each(function () {
        var _this = this;
        var el = $(_this).data('countdate');
        var countDownDate = new Date(el).getTime();
        var x = setInterval(function () {
          var now = new Date().getTime();
          var distance = countDownDate - now;
          var days = Math.floor(distance / (1000 * 60 * 60 * 24));
          var hours = Math.floor(distance % (1000 * 60 * 60 * 24) / (1000 * 60 * 60));
          var minutes = Math.floor(distance % (1000 * 60 * 60) / (1000 * 60));
          var seconds = Math.floor(distance % (1000 * 60) / 1000);
          $(_this).find('#count-days').html(days);
          $(_this).find('#count-hours').html(hours);
          $(_this).find('#count-minutes').html(minutes);
          $(_this).find('#count-seconds').html(seconds);
          if (distance < 0) {
            clearInterval(x);
            $(_this).html("TOKEN EXPIRED")
          }
        }, 1000)
      })
    }
  }

  function sectionScroll() {
    if ($.exists('.scroll-section')) {
      var totalScrollSection = $('.scroll-section').length;
      var scrollBarHeight = (100 / totalScrollSection) + '%';
      $('.scroll-vertical-bar span').css('height', scrollBarHeight);
      $('.scroll-number-total').text(totalScrollSection);
      $('.scroll-section').eq(0).addClass('active');
      $.scrollify({
        section: ".scroll-section",
        sectionName: !1,
        interstitialSection: ".site-footer.style1",
        scrollSpeed: 1200,
        before: function (index, sections) {
          $('.scroll-number-present').text(index + 1);
          scrollBarHeight = ((100 / totalScrollSection) * (index + 1)) + '%';
          $('.scroll-vertical-bar span').css('height', scrollBarHeight);
          $('.scroll-section').removeClass('active');
          $('.scroll-section').eq(index).addClass('active')
        }
      });
      $('.scroll-down-btn').on('click', function (e) {
        e.preventDefault();
        $.scrollify.next()
      });
      $('.scroll-up-btn').on('click', function (e) {
        e.preventDefault();
        $.scrollify.previous()
      });
      if ($.exists('.site-header')) {
        var thisHeight = $('.site-header').height() + 'px'
      }
    }
  }

  function tbSvgShape() {
    if ($.exists('.svg-shape')) {
      var tbDomSvg = {};
      tbDomSvg.svg = document.querySelector('.svg-shape');
      tbDomSvg.shapeEl = tbDomSvg.svg.querySelector('path');
      var shapes = [{
        path: 'M 262.9,252.2 C 210.1,338.2 212.6,487.6 288.8,553.9 372.2,626.5 511.2,517.8 620.3,536.3 750.6,558.4 860.3,723 987.3,686.5 1089,657.3 1168,534.7 1173,429.2 1178,313.7 1096,189.1 995.1,130.7 852.1,47.07 658.8,78.95 498.1,119.2 410.7,141.1 322.6,154.8 262.9,252.2 Z',
        pathAlt: 'M 262.9,252.2 C 210.1,338.2 273.3,400.5 298.5,520 323.7,639.6 511.2,537.2 620.3,555.7 750.6,577.8 872.2,707.4 987.3,686.5 1102,665.6 1218,547.8 1173,429.2 1128,310.6 1096,189.1 995.1,130.7 852.1,47.07 658.8,78.95 498.1,119.2 410.7,141.1 322.6,154.8 262.9,252.2 Z',
        scaleX: 1.3,
        scaleY: 1.8,
        rotate: 70,
        tx: 0,
        ty: -100,
        animation: {
          path: {
            duration: 1000,
            easing: 'easeInOutQuad'
          }
        }
      }];
      var step;
      var initShapeLoop = function (pos) {
        pos = pos || 0;
        anime.remove(tbDomSvg.shapeEl);
        anime({
          targets: tbDomSvg.shapeEl,
          easing: 'linear',
          d: [{
            value: shapes[pos].pathAlt,
            duration: 1500
          }, {
            value: shapes[pos].path,
            duration: 1500
          }],
          loop: !0,
          direction: 'alternate'
        })
      };
      var initShapeEl = function () {
        anime.remove(tbDomSvg.svg);
        anime({
          targets: tbDomSvg.svg,
          duration: 1,
          easing: 'linear',
          scaleX: shapes[0].scaleX,
          scaleY: shapes[0].scaleY,
          translateX: shapes[0].tx + 'px',
          translateY: shapes[0].ty + 'px',
          rotate: shapes[0].rotate + 'deg'
        });
        initShapeLoop()
      };
      initShapeEl()
    }
  }

  function appleTVeffect() {
    $(document).on('mousemove', '.hover-layer', function (event) {
      var halfW = (this.clientWidth / 2);
      var halfH = (this.clientHeight / 2);
      var coorX = (halfW - (event.pageX - $(this).offset().left));
      var coorY = (halfH - (event.pageY - $(this).offset().top));
      var degX = ((coorY / halfH) * 8) + 'deg';
      var degY = ((coorX / halfW) * -8) + 'deg';
      $(this).css('transform', function () {
        return 'perspective( 600px ) translate3d( 0, -2px, 0 ) rotateX(' + degX + ') rotateY(' + degY + ')'
      }).find('.hover-layer1').css('transform', function () {
        return 'perspective( 600px ) translate3d( 0, 0, 0 ) rotateX(' + degX + ') rotateY(' + degY + ')'
      })
    }).on('mouseout', '.hover-layer', function () {
      $(this).removeAttr('style').find('.hover-layer1').removeAttr('style')
    })
  }

  function beforeAfterSlider() {
    if ($.exists('.before-after')) {
      var supportsTouch = 'ontouchstart' in window || navigator.msMaxTouchPoints;
      $('.before-after').each(function () {
        var $container = $(this),
          $before = $container.find('.before'),
          $after = $container.find('.after'),
          $handle = $container.find('.handle-before-after');
        var maxX = $container.outerWidth(),
          offsetX = $container.offset().left,
          startX = 0;
        var touchstart, touchmove, touchend;
        var mousemove = function (e) {
          e.preventDefault();
          var curX = e.clientX - offsetX,
            diff = startX - curX,
            curPos = (curX / maxX) * 100;
          if (curPos > 100) {
            curPos = 100
          }
          if (curPos < 0) {
            curPos = 0
          }
          $before.css({
            right: (100 - curPos) + "%"
          });
          $handle.css({
            left: curPos + "%"
          })
        };
        var mouseup = function (e) {
          e.preventDefault();
          if (supportsTouch) {
            $(document).off('touchmove', touchmove);
            $(document).off('touchend', touchend)
          } else {
            $(document).off('mousemove', mousemove);
            $(document).off('mouseup', mouseup)
          }
        };
        var mousedown = function (e) {
          e.preventDefault();
          startX = e.clientX - offsetX;
          if (supportsTouch) {
            $(document).on('touchmove', touchmove);
            $(document).on('touchend', touchend)
          } else {
            $(document).on('mousemove', mousemove);
            $(document).on('mouseup', mouseup)
          }
        };
        touchstart = function (e) {
          console.log(e);
          mousedown({
            preventDefault: e.preventDefault,
            clientX: e.originalEvent.changedTouches[0].pageX
          })
        };
        touchmove = function (e) {
          mousemove({
            preventDefault: e.preventDefault,
            clientX: e.originalEvent.changedTouches[0].pageX
          })
        };
        touchend = function (e) {
          mouseup({
            preventDefault: e.preventDefault,
            clientX: e.originalEvent.changedTouches[0].pageX
          })
        };
        if (supportsTouch) {
          $handle.on('touchstart', touchstart)
        } else {
          $handle.on('mousedown', mousedown)
        }
      })
    }
  }

  function postVoteCount() {
    $('.vote-btn').each(function () {
      $(this).on('click', function (e) {
        e.preventDefault();
        var parent = $(this).parent('.votes'),
          post_id = parent.data('post-id'),
          count = parent.find('.count-no'),
          $this = $(this),
          flag;
        if ($this.hasClass('voted')) {
          alert('Already Voted');
          return !1
        } else if ($this.hasClass('up-vote-btn')) {
          flag = 'true';
          count.text(parseInt(count.text()) + 1);
          $this.addClass('up-voted voted');
          $this.siblings('.down-vote-btn').removeClass('voted')
        } else {
          flag = 'false';
          count.text(parseInt(count.text()) - 1);
          $this.addClass('down-voted voted');
          $this.siblings('.up-vote-btn').removeClass('voted')
        }
        $.ajax({
          type: 'POST',
          url: get.ajaxurl,
          data: ({
            action: 'post-vote',
            is_up: flag,
            id: post_id,
            vote_nonce: get.nonce
          }),
        })
      })
    })
  }

  function googleMap() {
    if ($('#map').length > 0) {
      var el = $('.map-wrap'),
        lat = el.data('lat'),
        lng = el.data('lng'),
        zoom = el.data('zoom'),
        marker = el.data('marker'),
        marker_url = (!marker || marker.length === 0) ? get.siteurl + '/assets/img/map-marker.png' : marker;
      el.each(function () {
        var contactmap = {
          lat: lat,
          lng: lng
        };
        el.find('#map').gmap3({
          zoom: zoom,
          center: contactmap,
          scrollwheel: !1,
        }).marker({
          position: contactmap,
          icon: marker_url
        })
      })
    }
  }

  function qtyStepper() {
    if (typeof $.fn.number != 'function') {
      return
    }
    if ($('input[type=number]').length) {
      $('input[type=number]').number()
    }
  }

  function youtubePlaylist() {
    if ($('.yt-playlist').length) {
      var wrapper = $('#frame');
      var channelId = wrapper.data('channel-id');
      var ytp = new YTV('frame', {
        channelId: channelId,
        playerTheme: 'dark',
        responsive: !0
      })
    }
  }

  function ajaxPagination() {
    $('.ajax-load-more').each(function () {
      var $this = $(this),
        $container = $this.parent().find('.post-outerwrapper'),
        token = $this.data('token'),
        settings = window['webify_load_more_' + token],
        is_isotope = parseInt(settings.isotope),
        paging = 1,
        flood = !1,
        ajax_data;
      $this.bind('click', function () {
        if (flood === !1) {
          paging++;
          flood = !0;
          ajax_data = $.extend({}, {
            action: 'ajax-pagination',
            paged: paging
          }, settings);
          $.ajax({
            type: 'POST',
            url: get.ajaxurl,
            data: ajax_data,
            dataType: 'html',
            beforeSend: function () {
              $this.addClass('more-loading');
              $this.html('Loading...')
            },
            success: function (html) {
              var content = $(html).css('opacity', 0);
              if (is_isotope) {
                content.imagesLoaded(function () {
                  $container.append(content).isotope('appended', content);
                  $container.isotope('layout')
                })
              } else {
                $(content).insertBefore($this.parent())
              }
              content.animate({
                'opacity': 1
              }, 250);
              $this.removeClass('more-loading');
              $this.html('Load More');
              if (parseInt(settings.max_pages) == paging) {
                $this.hide()
              }
              flood = !1
            }
          })
        }
        return !1
      })
    })
  }

  function onePage() {
    $('.site-header a').on('click', function () {
      var thisAttr = $(this).attr('href');
      if ($(thisAttr).length) {
        var scrollPoint = $(thisAttr).offset().top - 120;
        $('body,html').animate({
          scrollTop: scrollPoint
        }, 600)
      }
      return !1
    })
  }

  function foodMenuList() {
    $('.food-list').addClass('food-list-isotope');
    var isotopeActiveClass = $('.food-menu-wrap .active').children('a').data('filter');
    $(isotopeActiveClass).addClass('show-isotope-item');
    $('.food-menu a').on('click', function () {
      $(this).parents('.food-menu-wrap').find('.food-list').removeClass('food-list-isotope')
    })
  }

  function parallax() {
    if ($.exists('.parallax')) {
      var numItems = $('.parallax').length;
      for (var loopI = 0; loopI < numItems; loopI++) {
        $('body').find('.parallax').eq(loopI).addClass('parallax' + loopI);
        var speed = $('.parallax' + loopI).data('speed');
        $('.parallax' + loopI).parallax('50%', speed)
      }
    }
  }

  function searchModal() {
    $('.search-modal-btn').on('click', function () {
      $('.search-modal').toggleClass('active')
    })
    $('.search-modal-cross, .search-modal-overlay').on('click', function () {
      $('.search-modal').removeClass('active')
    })
  }

  function audioPlayerSetup() {
    if ($.exists('.audio-player')) {
      $('.audio-player').audioPlayer()
    }
  }

  function zoomEffect() {
    if ($.exists('.product-zoom')) {
      $('.product-zoom').zoom()
    }
  }

  function datePickerSetup() {
    if ($.exists('.cs-date')) {
      $('.cs-date').datepicker()
    }
  }

  function cursorPlus() {
    $('.image-box.style2 a, .horizontal-scroll-item a').each(function () {
      $(this).append('<div class="cursor"></div>');
      $(this).on('mousemove', function (ev) {
        var cursorOffsetY = $(this).offset().top;
        var cursorOffsetX = $(this).offset().left;
        var mouseLeft = (ev.pageX - cursorOffsetX - 22) + 'px';
        var mouseRight = (ev.pageY - cursorOffsetY - 22) + 'px';
        $(this).find('.cursor').css({
          'left': mouseLeft,
          'top': mouseRight
        })
      })
    })
  }
  $(window).on('elementor/frontend/init', function () {
    elementorFrontend.hooks.addAction('init', function () {
      console.log(this.getSettings('selectors.container'))
    });
    elementorFrontend.hooks.addAction('frontend/element_ready/webify-portfolio-widget.default', function ($scope, $) {
      isotopMsSetup()
    });
    elementorFrontend.hooks.addAction('frontend/element_ready/webify-image-gallery-widget.default', function ($scope, $) {
      isotopMsSetup()
    });
    elementorFrontend.hooks.addAction('frontend/element_ready/webify-menu-widget.default', function ($scope, $) {
      isotopMsSetup()
    });
    elementorFrontend.hooks.addAction('frontend/element_ready/webify-blog-widget.default', function ($scope, $) {
      var selector = $scope.find('.blog-content');
      selector.imagesLoaded(function () {
        isotopMsSetup()
      })
    });
    elementorFrontend.hooks.addAction('frontend/element_ready/webify-client-widget.default', function ($scope, $) {
      swiperSlider()
    });
    elementorFrontend.hooks.addAction('frontend/element_ready/webify-hero-slider-widget.default', function ($scope, $) {
      swiperSlider()
    });
    elementorFrontend.hooks.addAction('frontend/element_ready/webify-road-map-widget.default', function ($scope, $) {
      swiperSlider()
    });
    elementorFrontend.hooks.addAction('frontend/element_ready/webify-text-block-with-gallery-widget.default', function ($scope, $) {
      swiperSlider()
    });
    elementorFrontend.hooks.addAction('frontend/element_ready/webify-road-map-widget.default', function ($scope, $) {
      swiperSlider()
    });
    elementorFrontend.hooks.addAction('frontend/element_ready/webify-product-slider-widget.default', function ($scope, $) {
      swiperSlider()
    });
    elementorFrontend.hooks.addAction('frontend/element_ready/webify-icon-box-slider-widget.default', function ($scope, $) {
      swiperSlider()
    });
    elementorFrontend.hooks.addAction('frontend/element_ready/webify-portfolio-slider-widget.default', function ($scope, $) {
      swiperSlider()
    });
    elementorFrontend.hooks.addAction('frontend/element_ready/webify-accordion-widget.default', function ($scope, $) {
      accordianSetup()
    });
    elementorFrontend.hooks.addAction('frontend/element_ready/webify-line-chart-widget.default', function ($scope, $) {
      lineChart()
    });
    elementorFrontend.hooks.addAction('frontend/element_ready/webify-round-chart-widget.default', function ($scope, $) {
      roundChart()
    });
    elementorFrontend.hooks.addAction('frontend/element_ready/webify-count-down-widget.default', function ($scope, $) { });
    elementorFrontend.hooks.addAction('frontend/element_ready/webify-testimonial-slider-widget.default', function ($scope, $) {
      swiperSlider()
    });
    elementorFrontend.hooks.addAction('frontend/element_ready/webify-team-slider-widget.default', function ($scope, $) {
      swiperSlider()
    });
    elementorFrontend.hooks.addAction('frontend/element_ready/webify-image-box-slider-widget.default', function ($scope, $) {
      swiperSlider()
    });
    elementorFrontend.hooks.addAction('frontend/element_ready/webify-image-gallery-slider-widget.default', function ($scope, $) {
      swiperSlider()
    });
    elementorFrontend.hooks.addAction('frontend/element_ready/webify-fancy-box-slider-widget.default', function ($scope, $) {
      swiperSlider()
    });
    elementorFrontend.hooks.addAction('frontend/element_ready/webify-award-widget.default', function ($scope, $) {
      swiperSlider()
    });
    elementorFrontend.hooks.addAction('frontend/element_ready/webify-blog-slider-widget.default', function ($scope, $) {
      swiperSlider()
    });
    elementorFrontend.hooks.addAction('frontend/element_ready/webify-progress-bar-widget.default', function ($scope, $) {
      horizontalProgressBar()
    });
    elementorFrontend.hooks.addAction('frontend/element_ready/webify-google-map-widget.default', function ($scope, $) {
      googleMap()
    });
    elementorFrontend.hooks.addAction('frontend/element_ready/webify-portfolio-section-scroll-widget.default', function ($scope, $) {
      sectionScroll()
    });
    elementorFrontend.hooks.addAction('frontend/element_ready/webify-tabs-widget.default', function ($scope, $) {
      tabs()
    });
    elementorFrontend.hooks.addAction('frontend/element_ready/webify-youtube-video-playlist-widget.default', function ($scope, $) {
      youtubePlaylist()
    })
  })
})(jQuery); /*! This file is auto-generated */
/*!
 * imagesLoaded PACKAGED v4.1.4
 * JavaScript is all like "You images are done yet or what?"
 * MIT License
 */
! function (e, t) {
  "function" == typeof define && define.amd ? define("ev-emitter/ev-emitter", t) : "object" == typeof module && module.exports ? module.exports = t() : e.EvEmitter = t()
}("undefined" != typeof window ? window : this, function () {
  function e() { }
  var t = e.prototype;
  return t.on = function (e, t) {
    if (e && t) {
      var i = this._events = this._events || {},
        n = i[e] = i[e] || [];
      return n.indexOf(t) == -1 && n.push(t), this
    }
  }, t.once = function (e, t) {
    if (e && t) {
      this.on(e, t);
      var i = this._onceEvents = this._onceEvents || {},
        n = i[e] = i[e] || {};
      return n[t] = !0, this
    }
  }, t.off = function (e, t) {
    var i = this._events && this._events[e];
    if (i && i.length) {
      var n = i.indexOf(t);
      return n != -1 && i.splice(n, 1), this
    }
  }, t.emitEvent = function (e, t) {
    var i = this._events && this._events[e];
    if (i && i.length) {
      i = i.slice(0), t = t || [];
      for (var n = this._onceEvents && this._onceEvents[e], o = 0; o < i.length; o++) {
        var r = i[o],
          s = n && n[r];
        s && (this.off(e, r), delete n[r]), r.apply(this, t)
      }
      return this
    }
  }, t.allOff = function () {
    delete this._events, delete this._onceEvents
  }, e
}),
  function (e, t) {
    "use strict";
    "function" == typeof define && define.amd ? define(["ev-emitter/ev-emitter"], function (i) {
      return t(e, i)
    }) : "object" == typeof module && module.exports ? module.exports = t(e, require("ev-emitter")) : e.imagesLoaded = t(e, e.EvEmitter)
  }("undefined" != typeof window ? window : this, function (e, t) {
    function i(e, t) {
      for (var i in t) e[i] = t[i];
      return e
    }

    function n(e) {
      if (Array.isArray(e)) return e;
      var t = "object" == typeof e && "number" == typeof e.length;
      return t ? d.call(e) : [e]
    }

    function o(e, t, r) {
      if (!(this instanceof o)) return new o(e, t, r);
      var s = e;
      return "string" == typeof e && (s = document.querySelectorAll(e)), s ? (this.elements = n(s), this.options = i({}, this.options), "function" == typeof t ? r = t : i(this.options, t), r && this.on("always", r), this.getImages(), h && (this.jqDeferred = new h.Deferred), void setTimeout(this.check.bind(this))) : void a.error("Bad element for imagesLoaded " + (s || e))
    }

    function r(e) {
      this.img = e
    }

    function s(e, t) {
      this.url = e, this.element = t, this.img = new Image
    }
    var h = e.jQuery,
      a = e.console,
      d = Array.prototype.slice;
    o.prototype = Object.create(t.prototype), o.prototype.options = {}, o.prototype.getImages = function () {
      this.images = [], this.elements.forEach(this.addElementImages, this)
    }, o.prototype.addElementImages = function (e) {
      "IMG" == e.nodeName && this.addImage(e), this.options.background === !0 && this.addElementBackgroundImages(e);
      var t = e.nodeType;
      if (t && u[t]) {
        for (var i = e.querySelectorAll("img"), n = 0; n < i.length; n++) {
          var o = i[n];
          this.addImage(o)
        }
        if ("string" == typeof this.options.background) {
          var r = e.querySelectorAll(this.options.background);
          for (n = 0; n < r.length; n++) {
            var s = r[n];
            this.addElementBackgroundImages(s)
          }
        }
      }
    };
    var u = {
      1: !0,
      9: !0,
      11: !0
    };
    return o.prototype.addElementBackgroundImages = function (e) {
      var t = getComputedStyle(e);
      if (t)
        for (var i = /url\((['"])?(.*?)\1\)/gi, n = i.exec(t.backgroundImage); null !== n;) {
          var o = n && n[2];
          o && this.addBackground(o, e), n = i.exec(t.backgroundImage)
        }
    }, o.prototype.addImage = function (e) {
      var t = new r(e);
      this.images.push(t)
    }, o.prototype.addBackground = function (e, t) {
      var i = new s(e, t);
      this.images.push(i)
    }, o.prototype.check = function () {
      function e(e, i, n) {
        setTimeout(function () {
          t.progress(e, i, n)
        })
      }
      var t = this;
      return this.progressedCount = 0, this.hasAnyBroken = !1, this.images.length ? void this.images.forEach(function (t) {
        t.once("progress", e), t.check()
      }) : void this.complete()
    }, o.prototype.progress = function (e, t, i) {
      this.progressedCount++, this.hasAnyBroken = this.hasAnyBroken || !e.isLoaded, this.emitEvent("progress", [this, e, t]), this.jqDeferred && this.jqDeferred.notify && this.jqDeferred.notify(this, e), this.progressedCount == this.images.length && this.complete(), this.options.debug && a && a.log("progress: " + i, e, t)
    }, o.prototype.complete = function () {
      var e = this.hasAnyBroken ? "fail" : "done";
      if (this.isComplete = !0, this.emitEvent(e, [this]), this.emitEvent("always", [this]), this.jqDeferred) {
        var t = this.hasAnyBroken ? "reject" : "resolve";
        this.jqDeferred[t](this)
      }
    }, r.prototype = Object.create(t.prototype), r.prototype.check = function () {
      var e = this.getIsImageComplete();
      return e ? void this.confirm(0 !== this.img.naturalWidth, "naturalWidth") : (this.proxyImage = new Image, this.proxyImage.addEventListener("load", this), this.proxyImage.addEventListener("error", this), this.img.addEventListener("load", this), this.img.addEventListener("error", this), void (this.proxyImage.src = this.img.src))
    }, r.prototype.getIsImageComplete = function () {
      return this.img.complete && this.img.naturalWidth
    }, r.prototype.confirm = function (e, t) {
      this.isLoaded = e, this.emitEvent("progress", [this, this.img, t])
    }, r.prototype.handleEvent = function (e) {
      var t = "on" + e.type;
      this[t] && this[t](e)
    }, r.prototype.onload = function () {
      this.confirm(!0, "onload"), this.unbindEvents()
    }, r.prototype.onerror = function () {
      this.confirm(!1, "onerror"), this.unbindEvents()
    }, r.prototype.unbindEvents = function () {
      this.proxyImage.removeEventListener("load", this), this.proxyImage.removeEventListener("error", this), this.img.removeEventListener("load", this), this.img.removeEventListener("error", this)
    }, s.prototype = Object.create(r.prototype), s.prototype.check = function () {
      this.img.addEventListener("load", this), this.img.addEventListener("error", this), this.img.src = this.url;
      var e = this.getIsImageComplete();
      e && (this.confirm(0 !== this.img.naturalWidth, "naturalWidth"), this.unbindEvents())
    }, s.prototype.unbindEvents = function () {
      this.img.removeEventListener("load", this), this.img.removeEventListener("error", this)
    }, s.prototype.confirm = function (e, t) {
      this.isLoaded = e, this.emitEvent("progress", [this, this.element, t])
    }, o.makeJQueryPlugin = function (t) {
      t = t || e.jQuery, t && (h = t, h.fn.imagesLoaded = function (e, t) {
        var i = new o(this, e, t);
        return i.jqDeferred.promise(h(this))
      })
    }, o.makeJQueryPlugin(), o
  }); /*! This file is auto-generated */
! function (d, l) {
  "use strict";
  var e = !1,
    o = !1;
  if (l.querySelector)
    if (d.addEventListener) e = !0;
  if (d.wp = d.wp || {}, !d.wp.receiveEmbedMessage)
    if (d.wp.receiveEmbedMessage = function (e) {
      var t = e.data;
      if (t)
        if (t.secret || t.message || t.value)
          if (!/[^a-zA-Z0-9]/.test(t.secret)) {
            var r, a, i, s, n, o = l.querySelectorAll('iframe[data-secret="' + t.secret + '"]'),
              c = l.querySelectorAll('blockquote[data-secret="' + t.secret + '"]');
            for (r = 0; r < c.length; r++) c[r].style.display = "none";
            for (r = 0; r < o.length; r++)
              if (a = o[r], e.source === a.contentWindow) {
                if (a.removeAttribute("style"), "height" === t.message) {
                  if (1e3 < (i = parseInt(t.value, 10))) i = 1e3;
                  else if (~~i < 200) i = 200;
                  a.height = i
                }
                if ("link" === t.message)
                  if (s = l.createElement("a"), n = l.createElement("a"), s.href = a.getAttribute("src"), n.href = t.value, n.host === s.host)
                    if (l.activeElement === a) d.top.location.href = t.value
              }
          }
    }, e) d.addEventListener("message", d.wp.receiveEmbedMessage, !1), l.addEventListener("DOMContentLoaded", t, !1), d.addEventListener("load", t, !1);

  function t() {
    if (!o) {
      o = !0;
      var e, t, r, a, i = -1 !== navigator.appVersion.indexOf("MSIE 10"),
        s = !!navigator.userAgent.match(/Trident.*rv:11\./),
        n = l.querySelectorAll("iframe.wp-embedded-content");
      for (t = 0; t < n.length; t++) {
        if (!(r = n[t]).getAttribute("data-secret")) a = Math.random().toString(36).substr(2, 10), r.src += "#?secret=" + a, r.setAttribute("data-secret", a);
        if (i || s) (e = r.cloneNode(!0)).removeAttribute("security"), r.parentNode.replaceChild(e, r)
      }
    }
  }
}(window, document);
/*!
 * jQuery Scrollify
 * Version 1.0.20
 *
 * Requires:
 * - jQuery 1.7 or higher
 *
 * https://github.com/lukehaas/Scrollify
 *
 * Copyright 2016, Luke Haas
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.



if touchScroll is false - update index

 */
(function (global, factory) {
  "use strict";
  if (typeof define === 'function' && define.amd) {
    define(['jquery'], function ($) {
      return factory($, global, global.document)
    })
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('jquery'), global, global.document)
  } else {
    factory(jQuery, global, global.document)
  }
}(typeof window !== 'undefined' ? window : this, function ($, window, document, undefined) {
  "use strict";
  var heights = [],
    names = [],
    elements = [],
    overflow = [],
    index = 0,
    currentIndex = 0,
    interstitialIndex = 1,
    hasLocation = !1,
    timeoutId, timeoutId2, $window = $(window),
    portHeight, top = $window.scrollTop(),
    scrollable = !1,
    locked = !1,
    scrolled = !1,
    manualScroll, swipeScroll, util, disabled = !1,
    scrollSamples = [],
    scrollTime = new Date().getTime(),
    firstLoad = !0,
    initialised = !1,
    destination = 0,
    wheelEvent = 'onwheel' in document ? 'wheel' : document.onmousewheel !== undefined ? 'mousewheel' : 'DOMMouseScroll',
    settings = {
      section: ".section",
      sectionName: "section-name",
      interstitialSection: "",
      easing: "easeOutExpo",
      scrollSpeed: 1100,
      offset: 0,
      scrollbars: !0,
      target: "html,body",
      standardScrollElements: !1,
      setHeights: !0,
      overflowScroll: !0,
      updateHash: !0,
      touchScroll: !0,
      before: function () { },
      after: function () { },
      afterResize: function () { },
      afterRender: function () { }
    };

  function getportHeight() {
    return ($window.height() + settings.offset)
  }

  function animateScroll(index, instant, callbacks, toTop) {
    if (currentIndex === index) {
      callbacks = !1
    }
    if (disabled === !0) {
      return !0
    }
    if (names[index]) {
      scrollable = !1;
      if (firstLoad === !0) {
        firstLoad = !1;
        settings.afterRender()
      }
      if (callbacks) {
        if (typeof settings.before == 'function' && settings.before(index, elements) === !1) {
          return !0
        }
      }
      interstitialIndex = 1;
      destination = (!index) ? 0 : heights[index];
      if (firstLoad === !1 && currentIndex > index && toTop === !1) {
        if (overflow[index]) {
          portHeight = getportHeight();
          interstitialIndex = parseInt(elements[index].outerHeight() / portHeight);
          destination = parseInt(heights[index]) + (elements[index].outerHeight() - portHeight)
        }
      }
      if (settings.updateHash && settings.sectionName && !(firstLoad === !0 && index === 0)) {
        if (history.pushState) {
          try {
            history.replaceState(null, null, names[index])
          } catch (e) {
            if (window.console) {
              console.warn("Scrollify warning: Page must be hosted to manipulate the hash value.")
            }
          }
        } else {
          window.location.hash = names[index]
        }
      }
      currentIndex = index;
      if (instant) {
        $(settings.target).stop().scrollTop(destination);
        if (callbacks) {
          settings.after(index, elements)
        }
      } else {
        locked = !0;
        if ($().velocity) {
          $(settings.target).stop().velocity('scroll', {
            duration: settings.scrollSpeed,
            easing: settings.easing,
            offset: destination,
            mobileHA: !1
          })
        } else {
          $(settings.target).stop().animate({
            scrollTop: destination
          }, settings.scrollSpeed, settings.easing)
        }
        if (window.location.hash.length && settings.sectionName && window.console) {
          try {
            if ($(window.location.hash).length) {
              console.warn("Scrollify warning: ID matches hash value - this will cause the page to anchor.")
            }
          } catch (e) { }
        }
        $(settings.target).promise().done(function () {
          locked = !1;
          firstLoad = !1;
          if (callbacks) {
            settings.after(index, elements)
          }
        })
      }
    }
  }

  function isAccelerating(samples) {
    function average(num) {
      var sum = 0;
      var lastElements = samples.slice(Math.max(samples.length - num, 1));
      for (var i = 0; i < lastElements.length; i++) {
        sum += lastElements[i]
      }
      return Math.ceil(sum / num)
    }
    var avEnd = average(10);
    var avMiddle = average(70);
    if (avEnd >= avMiddle) {
      return !0
    } else {
      return !1
    }
  }
  var scrollify = function (options) {
    initialised = !0;
    $.easing.easeOutExpo = function (x, t, b, c, d) {
      return (t == d) ? b + c : c * (-Math.pow(2, -10 * t / d) + 1) + b
    };
    manualScroll = {
      handleMousedown: function () {
        if (disabled === !0) {
          return !0
        }
        scrollable = !1;
        scrolled = !1
      },
      handleMouseup: function () {
        if (disabled === !0) {
          return !0
        }
        scrollable = !0;
        if (scrolled) {
          manualScroll.calculateNearest(!1, !0)
        }
      },
      handleScroll: function () {
        if (disabled === !0) {
          return !0
        }
        if (timeoutId) {
          clearTimeout(timeoutId)
        }
        timeoutId = setTimeout(function () {
          scrolled = !0;
          if (scrollable === !1) {
            return !1
          }
          scrollable = !1;
          manualScroll.calculateNearest(!1, !0)
        }, 200)
      },
      calculateNearest: function (instant, callbacks) {
        top = $window.scrollTop();
        var i = 1,
          max = heights.length,
          closest = 0,
          prev = Math.abs(heights[0] - top),
          diff;
        for (; i < max; i++) {
          diff = Math.abs(heights[i] - top);
          if (diff < prev) {
            prev = diff;
            closest = i
          }
        }
        if ((atBottom() && closest > index) || atTop()) {
          index = closest;
          animateScroll(closest, instant, callbacks, !1)
        }
      },
      wheelHandler: function (e) {
        if (disabled === !0) {
          return !0
        } else if (settings.standardScrollElements) {
          if ($(e.target).is(settings.standardScrollElements) || $(e.target).closest(settings.standardScrollElements).length) {
            return !0
          }
        }
        if (!overflow[index]) {
          e.preventDefault()
        }
        var currentScrollTime = new Date().getTime();
        e = e || window.event;
        var value;
        if (e.originalEvent) {
          value = e.originalEvent.wheelDelta || -e.originalEvent.deltaY || -e.originalEvent.detail
        } else {
          value = e.wheelDelta || -e.deltaY || -e.detail
        }
        var delta = Math.max(-1, Math.min(1, value));
        if (scrollSamples.length > 149) {
          scrollSamples.shift()
        }
        scrollSamples.push(Math.abs(value));
        if ((currentScrollTime - scrollTime) > 200) {
          scrollSamples = []
        }
        scrollTime = currentScrollTime;
        if (locked) {
          return !1
        }
        if (delta < 0) {
          if (index < heights.length - 1) {
            if (atBottom()) {
              if (isAccelerating(scrollSamples)) {
                e.preventDefault();
                index++;
                locked = !0;
                animateScroll(index, !1, !0, !1)
              } else {
                return !1
              }
            }
          }
        } else if (delta > 0) {
          if (index > 0) {
            if (atTop()) {
              if (isAccelerating(scrollSamples)) {
                e.preventDefault();
                index--;
                locked = !0;
                animateScroll(index, !1, !0, !1)
              } else {
                return !1
              }
            }
          }
        }
      },
      keyHandler: function (e) {
        if (disabled === !0 || document.activeElement.readOnly === !1) {
          return !0
        } else if (settings.standardScrollElements) {
          if ($(e.target).is(settings.standardScrollElements) || $(e.target).closest(settings.standardScrollElements).length) {
            return !0
          }
        }
        if (locked === !0) {
          return !1
        }
        if (e.keyCode == 38 || e.keyCode == 33) {
          if (index > 0) {
            if (atTop()) {
              e.preventDefault();
              index--;
              animateScroll(index, !1, !0, !1)
            }
          }
        } else if (e.keyCode == 40 || e.keyCode == 34) {
          if (index < heights.length - 1) {
            if (atBottom()) {
              e.preventDefault();
              index++;
              animateScroll(index, !1, !0, !1)
            }
          }
        }
      },
      init: function () {
        if (settings.scrollbars) {
          $window.on('mousedown', manualScroll.handleMousedown);
          $window.on('mouseup', manualScroll.handleMouseup);
          $window.on('scroll', manualScroll.handleScroll)
        } else {
          $("body").css({
            "overflow": "hidden"
          })
        }
        window.addEventListener(wheelEvent, manualScroll.wheelHandler, {
          passive: !1
        });
        $window.on('keydown', manualScroll.keyHandler)
      }
    };
    swipeScroll = {
      touches: {
        "touchstart": {
          "y": -1,
          "x": -1
        },
        "touchmove": {
          "y": -1,
          "x": -1
        },
        "touchend": !1,
        "direction": "undetermined"
      },
      options: {
        "distance": 30,
        "timeGap": 800,
        "timeStamp": new Date().getTime()
      },
      touchHandler: function (event) {
        if (disabled === !0) {
          return !0
        } else if (settings.standardScrollElements) {
          if ($(event.target).is(settings.standardScrollElements) || $(event.target).closest(settings.standardScrollElements).length) {
            return !0
          }
        }
        var touch;
        if (typeof event !== 'undefined') {
          if (typeof event.touches !== 'undefined') {
            touch = event.touches[0];
            switch (event.type) {
              case 'touchstart':
                swipeScroll.touches.touchstart.y = touch.pageY;
                swipeScroll.touches.touchmove.y = -1;
                swipeScroll.touches.touchstart.x = touch.pageX;
                swipeScroll.touches.touchmove.x = -1;
                swipeScroll.options.timeStamp = new Date().getTime();
                swipeScroll.touches.touchend = !1;
              case 'touchmove':
                swipeScroll.touches.touchmove.y = touch.pageY;
                swipeScroll.touches.touchmove.x = touch.pageX;
                if (swipeScroll.touches.touchstart.y !== swipeScroll.touches.touchmove.y && (Math.abs(swipeScroll.touches.touchstart.y - swipeScroll.touches.touchmove.y) > Math.abs(swipeScroll.touches.touchstart.x - swipeScroll.touches.touchmove.x))) {
                  event.preventDefault();
                  swipeScroll.touches.direction = "y";
                  if ((swipeScroll.options.timeStamp + swipeScroll.options.timeGap) < (new Date().getTime()) && swipeScroll.touches.touchend == !1) {
                    swipeScroll.touches.touchend = !0;
                    if (swipeScroll.touches.touchstart.y > -1) {
                      if (Math.abs(swipeScroll.touches.touchmove.y - swipeScroll.touches.touchstart.y) > swipeScroll.options.distance) {
                        if (swipeScroll.touches.touchstart.y < swipeScroll.touches.touchmove.y) {
                          swipeScroll.up()
                        } else {
                          swipeScroll.down()
                        }
                      }
                    }
                  }
                }
                break;
              case 'touchend':
                if (swipeScroll.touches[event.type] === !1) {
                  swipeScroll.touches[event.type] = !0;
                  if (swipeScroll.touches.touchstart.y > -1 && swipeScroll.touches.touchmove.y > -1 && swipeScroll.touches.direction === "y") {
                    if (Math.abs(swipeScroll.touches.touchmove.y - swipeScroll.touches.touchstart.y) > swipeScroll.options.distance) {
                      if (swipeScroll.touches.touchstart.y < swipeScroll.touches.touchmove.y) {
                        swipeScroll.up()
                      } else {
                        swipeScroll.down()
                      }
                    }
                    swipeScroll.touches.touchstart.y = -1;
                    swipeScroll.touches.touchstart.x = -1;
                    swipeScroll.touches.direction = "undetermined"
                  }
                }
              default:
                break
            }
          }
        }
      },
      down: function () {
        if (index < heights.length) {
          if (atBottom() && index < heights.length - 1) {
            index++;
            animateScroll(index, !1, !0, !1)
          } else {
            portHeight = getportHeight();
            if (Math.floor(elements[index].height() / portHeight) > interstitialIndex) {
              interstitialScroll(parseInt(heights[index]) + (portHeight * interstitialIndex));
              interstitialIndex += 1
            } else {
              interstitialScroll(parseInt(heights[index]) + (elements[index].outerHeight() - portHeight))
            }
          }
        }
      },
      up: function () {
        if (index >= 0) {
          if (atTop() && index > 0) {
            index--;
            animateScroll(index, !1, !0, !1)
          } else {
            if (interstitialIndex > 2) {
              portHeight = getportHeight();
              interstitialIndex -= 1;
              interstitialScroll(parseInt(heights[index]) + (portHeight * interstitialIndex))
            } else {
              interstitialIndex = 1;
              interstitialScroll(parseInt(heights[index]))
            }
          }
        }
      },
      init: function () {
        if (document.addEventListener && settings.touchScroll) {
          var eventListenerOptions = {
            passive: !1
          };
          document.addEventListener('touchstart', swipeScroll.touchHandler, eventListenerOptions);
          document.addEventListener('touchmove', swipeScroll.touchHandler, eventListenerOptions);
          document.addEventListener('touchend', swipeScroll.touchHandler, eventListenerOptions)
        }
      }
    };
    util = {
      refresh: function (withCallback, scroll) {
        clearTimeout(timeoutId2);
        timeoutId2 = setTimeout(function () {
          sizePanels(!0);
          calculatePositions(scroll, !1);
          if (withCallback) {
            settings.afterResize()
          }
        }, 400)
      },
      handleUpdate: function () {
        util.refresh(!1, !1)
      },
      handleResize: function () {
        util.refresh(!0, !1)
      },
      handleOrientation: function () {
        util.refresh(!0, !0)
      }
    };
    settings = $.extend(settings, options);
    sizePanels(!1);
    calculatePositions(!1, !0);
    if (!0 === hasLocation) {
      animateScroll(index, !1, !0, !0)
    } else {
      setTimeout(function () {
        manualScroll.calculateNearest(!0, !1)
      }, 200)
    }
    if (heights.length) {
      manualScroll.init();
      swipeScroll.init();
      $window.on("resize", util.handleResize);
      if (document.addEventListener) {
        window.addEventListener("orientationchange", util.handleOrientation, !1)
      }
    }

    function interstitialScroll(pos) {
      if ($().velocity) {
        $(settings.target).stop().velocity('scroll', {
          duration: settings.scrollSpeed,
          easing: settings.easing,
          offset: pos,
          mobileHA: !1
        })
      } else {
        $(settings.target).stop().animate({
          scrollTop: pos
        }, settings.scrollSpeed, settings.easing)
      }
    }

    function sizePanels(keepPosition) {
      if (keepPosition) {
        top = $window.scrollTop()
      }
      var selector = settings.section;
      overflow = [];
      if (settings.interstitialSection.length) {
        selector += "," + settings.interstitialSection
      }
      if (settings.scrollbars === !1) {
        settings.overflowScroll = !1
      }
      portHeight = getportHeight();
      $(selector).each(function (i) {
        var $this = $(this);
        if (settings.setHeights) {
          if ($this.is(settings.interstitialSection)) {
            overflow[i] = !1
          } else {
            if (($this.css("height", "auto").outerHeight() < portHeight) || $this.css("overflow") === "hidden") {
              $this.css({
                "height": portHeight
              });
              overflow[i] = !1
            } else {
              $this.css({
                "height": $this.outerHeight()
              });
              if (settings.overflowScroll) {
                overflow[i] = !0
              } else {
                overflow[i] = !1
              }
            }
          }
        } else {
          if (($this.outerHeight() < portHeight) || (settings.overflowScroll === !1)) {
            overflow[i] = !1
          } else {
            overflow[i] = !0
          }
        }
      });
      if (keepPosition) {
        $window.scrollTop(top)
      }
    }

    function calculatePositions(scroll, firstLoad) {
      var selector = settings.section;
      if (settings.interstitialSection.length) {
        selector += "," + settings.interstitialSection
      }
      heights = [];
      names = [];
      elements = [];
      $(selector).each(function (i) {
        var $this = $(this);
        if (i > 0) {
          heights[i] = parseInt($this.offset().top) + settings.offset
        } else {
          heights[i] = parseInt($this.offset().top)
        }
        if (settings.sectionName && $this.data(settings.sectionName)) {
          names[i] = "#" + $this.data(settings.sectionName).toString().replace(/ /g, "-")
        } else {
          if ($this.is(settings.interstitialSection) === !1) {
            names[i] = "#" + (i + 1)
          } else {
            names[i] = "#";
            if (i === $(selector).length - 1 && i > 1) {
              heights[i] = heights[i - 1] + (parseInt($($(selector)[i - 1]).outerHeight()) - parseInt($(window).height())) + parseInt($this.outerHeight())
            }
          }
        }
        elements[i] = $this;
        try {
          if ($(names[i]).length && window.console) {
            console.warn("Scrollify warning: Section names can't match IDs - this will cause the browser to anchor.")
          }
        } catch (e) { }
        if (window.location.hash === names[i]) {
          index = i;
          hasLocation = !0
        }
      });
      if (!0 === scroll) {
        animateScroll(index, !1, !1, !1)
      }
    }

    function atTop() {
      if (!overflow[index]) {
        return !0
      }
      top = $window.scrollTop();
      if (top > parseInt(heights[index])) {
        return !1
      } else {
        return !0
      }
    }

    function atBottom() {
      if (!overflow[index]) {
        return !0
      }
      top = $window.scrollTop();
      portHeight = getportHeight();
      if (top < parseInt(heights[index]) + (elements[index].outerHeight() - portHeight) - 28) {
        return !1
      } else {
        return !0
      }
    }
  }

  function move(panel, instant) {
    var z = names.length;
    for (; z >= 0; z--) {
      if (typeof panel === 'string') {
        if (names[z] === panel) {
          index = z;
          animateScroll(z, instant, !0, !0)
        }
      } else {
        if (z === panel) {
          index = z;
          animateScroll(z, instant, !0, !0)
        }
      }
    }
  }
  scrollify.move = function (panel) {
    if (panel === undefined) {
      return !1
    }
    if (panel.originalEvent) {
      panel = $(this).attr("href")
    }
    move(panel, !1)
  };
  scrollify.instantMove = function (panel) {
    if (panel === undefined) {
      return !1
    }
    move(panel, !0)
  };
  scrollify.next = function () {
    if (index < names.length) {
      index += 1;
      animateScroll(index, !1, !0, !0)
    }
  };
  scrollify.previous = function () {
    if (index > 0) {
      index -= 1;
      animateScroll(index, !1, !0, !0)
    }
  };
  scrollify.instantNext = function () {
    if (index < names.length) {
      index += 1;
      animateScroll(index, !0, !0, !0)
    }
  };
  scrollify.instantPrevious = function () {
    if (index > 0) {
      index -= 1;
      animateScroll(index, !0, !0, !0)
    }
  };
  scrollify.destroy = function () {
    if (!initialised) {
      return !1
    }
    if (settings.setHeights) {
      $(settings.section).each(function () {
        $(this).css("height", "auto")
      })
    }
    $window.off("resize", util.handleResize);
    if (settings.scrollbars) {
      $window.off('mousedown', manualScroll.handleMousedown);
      $window.off('mouseup', manualScroll.handleMouseup);
      $window.off('scroll', manualScroll.handleScroll)
    }
    window.removeEventListener(wheelEvent, manualScroll.wheelHandler);
    $window.off('keydown', manualScroll.keyHandler);
    if (document.addEventListener && settings.touchScroll) {
      document.removeEventListener('touchstart', swipeScroll.touchHandler, !1);
      document.removeEventListener('touchmove', swipeScroll.touchHandler, !1);
      document.removeEventListener('touchend', swipeScroll.touchHandler, !1)
    }
    heights = [];
    names = [];
    elements = [];
    overflow = []
  };
  scrollify.update = function () {
    if (!initialised) {
      return !1
    }
    util.handleUpdate()
  };
  scrollify.current = function () {
    return elements[index]
  };
  scrollify.currentIndex = function () {
    return index
  };
  scrollify.disable = function () {
    disabled = !0
  };
  scrollify.enable = function () {
    disabled = !1;
    if (initialised) {
      manualScroll.calculateNearest(!1, !1)
    }
  };
  scrollify.isDisabled = function () {
    return disabled
  };
  scrollify.setOptions = function (updatedOptions) {
    if (!initialised) {
      return !1
    }
    if (typeof updatedOptions === "object") {
      settings = $.extend(settings, updatedOptions);
      util.handleUpdate()
    } else if (window.console) {
      console.warn("Scrollify warning: setOptions expects an object.")
    }
  };
  $.scrollify = scrollify;
  return scrollify
}));
! function (n, e) {
  "object" == typeof exports && "undefined" != typeof module ? module.exports = e() : "function" == typeof define && define.amd ? define(e) : n.anime = e()
}(this, function () {
  "use strict";
  var n = {
    update: null,
    begin: null,
    loopBegin: null,
    changeBegin: null,
    change: null,
    changeComplete: null,
    loopComplete: null,
    complete: null,
    loop: 1,
    direction: "normal",
    autoplay: !0,
    timelineOffset: 0
  },
    e = {
      duration: 1e3,
      delay: 0,
      endDelay: 0,
      easing: "easeOutElastic(1, .5)",
      round: 0
    },
    r = ["translateX", "translateY", "translateZ", "rotate", "rotateX", "rotateY", "rotateZ", "scale", "scaleX", "scaleY", "scaleZ", "skew", "skewX", "skewY", "perspective"],
    t = {
      CSS: {},
      springs: {}
    };

  function a(n, e, r) {
    return Math.min(Math.max(n, e), r)
  }

  function o(n, e) {
    return n.indexOf(e) > -1
  }

  function i(n, e) {
    return n.apply(null, e)
  }
  var u = {
    arr: function (n) {
      return Array.isArray(n)
    },
    obj: function (n) {
      return o(Object.prototype.toString.call(n), "Object")
    },
    pth: function (n) {
      return u.obj(n) && n.hasOwnProperty("totalLength")
    },
    svg: function (n) {
      return n instanceof SVGElement
    },
    inp: function (n) {
      return n instanceof HTMLInputElement
    },
    dom: function (n) {
      return n.nodeType || u.svg(n)
    },
    str: function (n) {
      return "string" == typeof n
    },
    fnc: function (n) {
      return "function" == typeof n
    },
    und: function (n) {
      return void 0 === n
    },
    hex: function (n) {
      return /(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i.test(n)
    },
    rgb: function (n) {
      return /^rgb/.test(n)
    },
    hsl: function (n) {
      return /^hsl/.test(n)
    },
    col: function (n) {
      return u.hex(n) || u.rgb(n) || u.hsl(n)
    },
    key: function (r) {
      return !n.hasOwnProperty(r) && !e.hasOwnProperty(r) && "targets" !== r && "keyframes" !== r
    }
  };

  function s(n) {
    var e = /\(([^)]+)\)/.exec(n);
    return e ? e[1].split(",").map(function (n) {
      return parseFloat(n)
    }) : []
  }

  function c(n, e) {
    var r = s(n),
      o = a(u.und(r[0]) ? 1 : r[0], .1, 100),
      i = a(u.und(r[1]) ? 100 : r[1], .1, 100),
      c = a(u.und(r[2]) ? 10 : r[2], .1, 100),
      f = a(u.und(r[3]) ? 0 : r[3], .1, 100),
      l = Math.sqrt(i / o),
      d = c / (2 * Math.sqrt(i * o)),
      p = d < 1 ? l * Math.sqrt(1 - d * d) : 0,
      v = 1,
      h = d < 1 ? (d * l - f) / p : -f + l;

    function g(n) {
      var r = e ? e * n / 1e3 : n;
      return r = d < 1 ? Math.exp(-r * d * l) * (v * Math.cos(p * r) + h * Math.sin(p * r)) : (v + h * r) * Math.exp(-r * l), 0 === n || 1 === n ? n : 1 - r
    }
    return e ? g : function () {
      var e = t.springs[n];
      if (e) return e;
      for (var r = 0, a = 0; ;)
        if (1 === g(r += 1 / 6)) {
          if (++a >= 16) break
        } else a = 0;
      var o = r * (1 / 6) * 1e3;
      return t.springs[n] = o, o
    }
  }

  function f(n, e) {
    void 0 === n && (n = 1), void 0 === e && (e = .5);
    var r = a(n, 1, 10),
      t = a(e, .1, 2);
    return function (n) {
      return 0 === n || 1 === n ? n : -r * Math.pow(2, 10 * (n - 1)) * Math.sin((n - 1 - t / (2 * Math.PI) * Math.asin(1 / r)) * (2 * Math.PI) / t)
    }
  }

  function l(n) {
    return void 0 === n && (n = 10),
      function (e) {
        return Math.round(e * n) * (1 / n)
      }
  }
  var d = function () {
    var n = 11,
      e = 1 / (n - 1);

    function r(n, e) {
      return 1 - 3 * e + 3 * n
    }

    function t(n, e) {
      return 3 * e - 6 * n
    }

    function a(n) {
      return 3 * n
    }

    function o(n, e, o) {
      return ((r(e, o) * n + t(e, o)) * n + a(e)) * n
    }

    function i(n, e, o) {
      return 3 * r(e, o) * n * n + 2 * t(e, o) * n + a(e)
    }
    return function (r, t, a, u) {
      if (0 <= r && r <= 1 && 0 <= a && a <= 1) {
        var s = new Float32Array(n);
        if (r !== t || a !== u)
          for (var c = 0; c < n; ++c) s[c] = o(c * e, r, a);
        return function (n) {
          return r === t && a === u ? n : 0 === n || 1 === n ? n : o(f(n), t, u)
        }
      }

      function f(t) {
        for (var u = 0, c = 1, f = n - 1; c !== f && s[c] <= t; ++c) u += e;
        var l = u + (t - s[--c]) / (s[c + 1] - s[c]) * e,
          d = i(l, r, a);
        return d >= .001 ? function (n, e, r, t) {
          for (var a = 0; a < 4; ++a) {
            var u = i(e, r, t);
            if (0 === u) return e;
            e -= (o(e, r, t) - n) / u
          }
          return e
        }(t, l, r, a) : 0 === d ? l : function (n, e, r, t, a) {
          for (var i, u, s = 0;
            (i = o(u = e + (r - e) / 2, t, a) - n) > 0 ? r = u : e = u, Math.abs(i) > 1e-7 && ++s < 10;);
          return u
        }(t, u, u + e, r, a)
      }
    }
  }(),
    p = function () {
      var n = ["Quad", "Cubic", "Quart", "Quint", "Sine", "Expo", "Circ", "Back", "Elastic"],
        e = {
          In: [
            [.55, .085, .68, .53],
            [.55, .055, .675, .19],
            [.895, .03, .685, .22],
            [.755, .05, .855, .06],
            [.47, 0, .745, .715],
            [.95, .05, .795, .035],
            [.6, .04, .98, .335],
            [.6, -.28, .735, .045], f
          ],
          Out: [
            [.25, .46, .45, .94],
            [.215, .61, .355, 1],
            [.165, .84, .44, 1],
            [.23, 1, .32, 1],
            [.39, .575, .565, 1],
            [.19, 1, .22, 1],
            [.075, .82, .165, 1],
            [.175, .885, .32, 1.275],
            function (n, e) {
              return function (r) {
                return 1 - f(n, e)(1 - r)
              }
            }
          ],
          InOut: [
            [.455, .03, .515, .955],
            [.645, .045, .355, 1],
            [.77, 0, .175, 1],
            [.86, 0, .07, 1],
            [.445, .05, .55, .95],
            [1, 0, 0, 1],
            [.785, .135, .15, .86],
            [.68, -.55, .265, 1.55],
            function (n, e) {
              return function (r) {
                return r < .5 ? f(n, e)(2 * r) / 2 : 1 - f(n, e)(-2 * r + 2) / 2
              }
            }
          ]
        },
        r = {
          linear: [.25, .25, .75, .75]
        },
        t = function (t) {
          e[t].forEach(function (e, a) {
            r["ease" + t + n[a]] = e
          })
        };
      for (var a in e) t(a);
      return r
    }();

  function v(n, e) {
    if (u.fnc(n)) return n;
    var r = n.split("(")[0],
      t = p[r],
      a = s(n);
    switch (r) {
      case "spring":
        return c(n, e);
      case "cubicBezier":
        return i(d, a);
      case "steps":
        return i(l, a);
      default:
        return u.fnc(t) ? i(t, a) : i(d, t)
    }
  }

  function h(n) {
    try {
      return document.querySelectorAll(n)
    } catch (n) {
      return
    }
  }

  function g(n, e) {
    for (var r = n.length, t = arguments.length >= 2 ? arguments[1] : void 0, a = [], o = 0; o < r; o++)
      if (o in n) {
        var i = n[o];
        e.call(t, i, o, n) && a.push(i)
      }
    return a
  }

  function m(n) {
    return n.reduce(function (n, e) {
      return n.concat(u.arr(e) ? m(e) : e)
    }, [])
  }

  function y(n) {
    return u.arr(n) ? n : (u.str(n) && (n = h(n) || n), n instanceof NodeList || n instanceof HTMLCollection ? [].slice.call(n) : [n])
  }

  function b(n, e) {
    return n.some(function (n) {
      return n === e
    })
  }

  function x(n) {
    var e = {};
    for (var r in n) e[r] = n[r];
    return e
  }

  function M(n, e) {
    var r = x(n);
    for (var t in n) r[t] = e.hasOwnProperty(t) ? e[t] : n[t];
    return r
  }

  function w(n, e) {
    var r = x(n);
    for (var t in e) r[t] = u.und(n[t]) ? e[t] : n[t];
    return r
  }

  function k(n) {
    return u.rgb(n) ? (r = /rgb\((\d+,\s*[\d]+,\s*[\d]+)\)/g.exec(e = n)) ? "rgba(" + r[1] + ",1)" : e : u.hex(n) ? (t = n.replace(/^#?([a-f\d])([a-f\d])([a-f\d])$/i, function (n, e, r, t) {
      return e + e + r + r + t + t
    }), a = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(t), "rgba(" + parseInt(a[1], 16) + "," + parseInt(a[2], 16) + "," + parseInt(a[3], 16) + ",1)") : u.hsl(n) ? function (n) {
      var e, r, t, a = /hsl\((\d+),\s*([\d.]+)%,\s*([\d.]+)%\)/g.exec(n) || /hsla\((\d+),\s*([\d.]+)%,\s*([\d.]+)%,\s*([\d.]+)\)/g.exec(n),
        o = parseInt(a[1], 10) / 360,
        i = parseInt(a[2], 10) / 100,
        u = parseInt(a[3], 10) / 100,
        s = a[4] || 1;

      function c(n, e, r) {
        return r < 0 && (r += 1), r > 1 && (r -= 1), r < 1 / 6 ? n + 6 * (e - n) * r : r < .5 ? e : r < 2 / 3 ? n + (e - n) * (2 / 3 - r) * 6 : n
      }
      if (0 == i) e = r = t = u;
      else {
        var f = u < .5 ? u * (1 + i) : u + i - u * i,
          l = 2 * u - f;
        e = c(l, f, o + 1 / 3), r = c(l, f, o), t = c(l, f, o - 1 / 3)
      }
      return "rgba(" + 255 * e + "," + 255 * r + "," + 255 * t + "," + s + ")"
    }(n) : void 0;
    var e, r, t, a
  }

  function C(n) {
    var e = /([\+\-]?[0-9#\.]+)(%|px|pt|em|rem|in|cm|mm|ex|ch|pc|vw|vh|vmin|vmax|deg|rad|turn)?$/.exec(n);
    if (e) return e[2]
  }

  function O(n, e) {
    return u.fnc(n) ? n(e.target, e.id, e.total) : n
  }

  function P(n, e) {
    return n.getAttribute(e)
  }

  function I(n, e, r) {
    if (b([r, "deg", "rad", "turn"], C(e))) return e;
    var a = t.CSS[e + r];
    if (!u.und(a)) return a;
    var o = document.createElement(n.tagName),
      i = n.parentNode && n.parentNode !== document ? n.parentNode : document.body;
    i.appendChild(o), o.style.position = "absolute", o.style.width = 100 + r;
    var s = 100 / o.offsetWidth;
    i.removeChild(o);
    var c = s * parseFloat(e);
    return t.CSS[e + r] = c, c
  }

  function B(n, e, r) {
    if (e in n.style) {
      var t = e.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase(),
        a = n.style[e] || getComputedStyle(n).getPropertyValue(t) || "0";
      return r ? I(n, a, r) : a
    }
  }

  function D(n, e) {
    return u.dom(n) && !u.inp(n) && (P(n, e) || u.svg(n) && n[e]) ? "attribute" : u.dom(n) && b(r, e) ? "transform" : u.dom(n) && "transform" !== e && B(n, e) ? "css" : null != n[e] ? "object" : void 0
  }

  function T(n) {
    if (u.dom(n)) {
      for (var e, r = n.style.transform || "", t = /(\w+)\(([^)]*)\)/g, a = new Map; e = t.exec(r);) a.set(e[1], e[2]);
      return a
    }
  }

  function F(n, e, r, t) {
    var a, i = o(e, "scale") ? 1 : 0 + (o(a = e, "translate") || "perspective" === a ? "px" : o(a, "rotate") || o(a, "skew") ? "deg" : void 0),
      u = T(n).get(e) || i;
    return r && (r.transforms.list.set(e, u), r.transforms.last = e), t ? I(n, u, t) : u
  }

  function N(n, e, r, t) {
    switch (D(n, e)) {
      case "transform":
        return F(n, e, t, r);
      case "css":
        return B(n, e, r);
      case "attribute":
        return P(n, e);
      default:
        return n[e] || 0
    }
  }

  function A(n, e) {
    var r = /^(\*=|\+=|-=)/.exec(n);
    if (!r) return n;
    var t = C(n) || 0,
      a = parseFloat(e),
      o = parseFloat(n.replace(r[0], ""));
    switch (r[0][0]) {
      case "+":
        return a + o + t;
      case "-":
        return a - o + t;
      case "*":
        return a * o + t
    }
  }

  function E(n, e) {
    if (u.col(n)) return k(n);
    var r = C(n),
      t = r ? n.substr(0, n.length - r.length) : n;
    return e && !/\s/g.test(n) ? t + e : t
  }

  function L(n, e) {
    return Math.sqrt(Math.pow(e.x - n.x, 2) + Math.pow(e.y - n.y, 2))
  }

  function S(n) {
    for (var e, r = n.points, t = 0, a = 0; a < r.numberOfItems; a++) {
      var o = r.getItem(a);
      a > 0 && (t += L(e, o)), e = o
    }
    return t
  }

  function j(n) {
    if (n.getTotalLength) return n.getTotalLength();
    switch (n.tagName.toLowerCase()) {
      case "circle":
        return o = n, 2 * Math.PI * P(o, "r");
      case "rect":
        return 2 * P(a = n, "width") + 2 * P(a, "height");
      case "line":
        return L({
          x: P(t = n, "x1"),
          y: P(t, "y1")
        }, {
          x: P(t, "x2"),
          y: P(t, "y2")
        });
      case "polyline":
        return S(n);
      case "polygon":
        return r = (e = n).points, S(e) + L(r.getItem(r.numberOfItems - 1), r.getItem(0))
    }
    var e, r, t, a, o
  }

  function q(n, e) {
    var r = e || {},
      t = r.el || function (n) {
        for (var e = n.parentNode; u.svg(e) && (e = e.parentNode, u.svg(e.parentNode)););
        return e
      }(n),
      a = t.getBoundingClientRect(),
      o = P(t, "viewBox"),
      i = a.width,
      s = a.height,
      c = r.viewBox || (o ? o.split(" ") : [0, 0, i, s]);
    return {
      el: t,
      viewBox: c,
      x: c[0] / 1,
      y: c[1] / 1,
      w: i / c[2],
      h: s / c[3]
    }
  }

  function $(n, e) {
    function r(r) {
      void 0 === r && (r = 0);
      var t = e + r >= 1 ? e + r : 0;
      return n.el.getPointAtLength(t)
    }
    var t = q(n.el, n.svg),
      a = r(),
      o = r(-1),
      i = r(1);
    switch (n.property) {
      case "x":
        return (a.x - t.x) * t.w;
      case "y":
        return (a.y - t.y) * t.h;
      case "angle":
        return 180 * Math.atan2(i.y - o.y, i.x - o.x) / Math.PI
    }
  }

  function X(n, e) {
    var r = /-?\d*\.?\d+/g,
      t = E(u.pth(n) ? n.totalLength : n, e) + "";
    return {
      original: t,
      numbers: t.match(r) ? t.match(r).map(Number) : [0],
      strings: u.str(n) || e ? t.split(r) : []
    }
  }

  function Y(n) {
    return g(n ? m(u.arr(n) ? n.map(y) : y(n)) : [], function (n, e, r) {
      return r.indexOf(n) === e
    })
  }

  function Z(n) {
    var e = Y(n);
    return e.map(function (n, r) {
      return {
        target: n,
        id: r,
        total: e.length,
        transforms: {
          list: T(n)
        }
      }
    })
  }

  function Q(n, e) {
    var r = x(e);
    if (/^spring/.test(r.easing) && (r.duration = c(r.easing)), u.arr(n)) {
      var t = n.length;
      2 === t && !u.obj(n[0]) ? n = {
        value: n
      } : u.fnc(e.duration) || (r.duration = e.duration / t)
    }
    var a = u.arr(n) ? n : [n];
    return a.map(function (n, r) {
      var t = u.obj(n) && !u.pth(n) ? n : {
        value: n
      };
      return u.und(t.delay) && (t.delay = r ? 0 : e.delay), u.und(t.endDelay) && (t.endDelay = r === a.length - 1 ? e.endDelay : 0), t
    }).map(function (n) {
      return w(n, r)
    })
  }

  function V(n, e) {
    var r = [],
      t = e.keyframes;
    for (var a in t && (e = w(function (n) {
      for (var e = g(m(n.map(function (n) {
        return Object.keys(n)
      })), function (n) {
        return u.key(n)
      }).reduce(function (n, e) {
        return n.indexOf(e) < 0 && n.push(e), n
      }, []), r = {}, t = function (t) {
        var a = e[t];
        r[a] = n.map(function (n) {
          var e = {};
          for (var r in n) u.key(r) ? r == a && (e.value = n[r]) : e[r] = n[r];
          return e
        })
      }, a = 0; a < e.length; a++) t(a);
      return r
    }(t), e)), e) u.key(a) && r.push({
      name: a,
      tweens: Q(e[a], n)
    });
    return r
  }

  function z(n, e) {
    var r;
    return n.tweens.map(function (t) {
      var a = function (n, e) {
        var r = {};
        for (var t in n) {
          var a = O(n[t], e);
          u.arr(a) && 1 === (a = a.map(function (n) {
            return O(n, e)
          })).length && (a = a[0]), r[t] = a
        }
        return r.duration = parseFloat(r.duration), r.delay = parseFloat(r.delay), r
      }(t, e),
        o = a.value,
        i = u.arr(o) ? o[1] : o,
        s = C(i),
        c = N(e.target, n.name, s, e),
        f = r ? r.to.original : c,
        l = u.arr(o) ? o[0] : f,
        d = C(l) || C(c),
        p = s || d;
      return u.und(i) && (i = f), a.from = X(l, p), a.to = X(A(i, l), p), a.start = r ? r.end : 0, a.end = a.start + a.delay + a.duration + a.endDelay, a.easing = v(a.easing, a.duration), a.isPath = u.pth(o), a.isColor = u.col(a.from.original), a.isColor && (a.round = 1), r = a, a
    })
  }
  var H = {
    css: function (n, e, r) {
      return n.style[e] = r
    },
    attribute: function (n, e, r) {
      return n.setAttribute(e, r)
    },
    object: function (n, e, r) {
      return n[e] = r
    },
    transform: function (n, e, r, t, a) {
      if (t.list.set(e, r), e === t.last || a) {
        var o = "";
        t.list.forEach(function (n, e) {
          o += e + "(" + n + ") "
        }), n.style.transform = o
      }
    }
  };

  function G(n, e) {
    Z(n).forEach(function (n) {
      for (var r in e) {
        var t = O(e[r], n),
          a = n.target,
          o = C(t),
          i = N(a, r, o, n),
          u = A(E(t, o || C(i)), i),
          s = D(a, r);
        H[s](a, r, u, n.transforms, !0)
      }
    })
  }

  function R(n, e) {
    return g(m(n.map(function (n) {
      return e.map(function (e) {
        return function (n, e) {
          var r = D(n.target, e.name);
          if (r) {
            var t = z(e, n),
              a = t[t.length - 1];
            return {
              type: r,
              property: e.name,
              animatable: n,
              tweens: t,
              duration: a.end,
              delay: t[0].delay,
              endDelay: a.endDelay
            }
          }
        }(n, e)
      })
    })), function (n) {
      return !u.und(n)
    })
  }

  function W(n, e) {
    var r = n.length,
      t = function (n) {
        return n.timelineOffset ? n.timelineOffset : 0
      },
      a = {};
    return a.duration = r ? Math.max.apply(Math, n.map(function (n) {
      return t(n) + n.duration
    })) : e.duration, a.delay = r ? Math.min.apply(Math, n.map(function (n) {
      return t(n) + n.delay
    })) : e.delay, a.endDelay = r ? a.duration - Math.max.apply(Math, n.map(function (n) {
      return t(n) + n.duration - n.endDelay
    })) : e.endDelay, a
  }
  var J = 0;
  var K, U = [],
    _ = [],
    nn = function () {
      function n() {
        K = requestAnimationFrame(e)
      }

      function e(e) {
        var r = U.length;
        if (r) {
          for (var t = 0; t < r;) {
            var a = U[t];
            if (a.paused) {
              var o = U.indexOf(a);
              o > -1 && (U.splice(o, 1), r = U.length)
            } else a.tick(e);
            t++
          }
          n()
        } else K = cancelAnimationFrame(K)
      }
      return n
    }();

  function en(r) {
    void 0 === r && (r = {});
    var t, o = 0,
      i = 0,
      u = 0,
      s = 0,
      c = null;

    function f(n) {
      var e = window.Promise && new Promise(function (n) {
        return c = n
      });
      return n.finished = e, e
    }
    var l, d, p, v, h, m, y, b, x = (d = M(n, l = r), p = M(e, l), v = V(p, l), h = Z(l.targets), m = R(h, v), y = W(m, p), b = J, J++, w(d, {
      id: b,
      children: [],
      animatables: h,
      animations: m,
      duration: y.duration,
      delay: y.delay,
      endDelay: y.endDelay
    }));
    f(x);

    function k() {
      var n = x.direction;
      "alternate" !== n && (x.direction = "normal" !== n ? "normal" : "reverse"), x.reversed = !x.reversed, t.forEach(function (n) {
        return n.reversed = x.reversed
      })
    }

    function C(n) {
      return x.reversed ? x.duration - n : n
    }

    function O() {
      o = 0, i = C(x.currentTime) * (1 / en.speed)
    }

    function P(n, e) {
      e && e.seek(n - e.timelineOffset)
    }

    function I(n) {
      for (var e = 0, r = x.animations, t = r.length; e < t;) {
        var o = r[e],
          i = o.animatable,
          u = o.tweens,
          s = u.length - 1,
          c = u[s];
        s && (c = g(u, function (e) {
          return n < e.end
        })[0] || c);
        for (var f = a(n - c.start - c.delay, 0, c.duration) / c.duration, l = isNaN(f) ? 1 : c.easing(f), d = c.to.strings, p = c.round, v = [], h = c.to.numbers.length, m = void 0, y = 0; y < h; y++) {
          var b = void 0,
            M = c.to.numbers[y],
            w = c.from.numbers[y] || 0;
          b = c.isPath ? $(c.value, l * M) : w + l * (M - w), p && (c.isColor && y > 2 || (b = Math.round(b * p) / p)), v.push(b)
        }
        var k = d.length;
        if (k) {
          m = d[0];
          for (var C = 0; C < k; C++) {
            d[C];
            var O = d[C + 1],
              P = v[C];
            isNaN(P) || (m += O ? P + O : P + " ")
          }
        } else m = v[0];
        H[o.type](i.target, o.property, m, i.transforms), o.currentValue = m, e++
      }
    }

    function B(n) {
      x[n] && !x.passThrough && x[n](x)
    }

    function D(n) {
      var e = x.duration,
        r = x.delay,
        l = e - x.endDelay,
        d = C(n);
      x.progress = a(d / e * 100, 0, 100), x.reversePlayback = d < x.currentTime, t && function (n) {
        if (x.reversePlayback)
          for (var e = s; e--;) P(n, t[e]);
        else
          for (var r = 0; r < s; r++) P(n, t[r])
      }(d), !x.began && x.currentTime > 0 && (x.began = !0, B("begin"), B("loopBegin")), d <= r && 0 !== x.currentTime && I(0), (d >= l && x.currentTime !== e || !e) && I(e), d > r && d < l ? (x.changeBegan || (x.changeBegan = !0, x.changeCompleted = !1, B("changeBegin")), B("change"), I(d)) : x.changeBegan && (x.changeCompleted = !0, x.changeBegan = !1, B("changeComplete")), x.currentTime = a(d, 0, e), x.began && B("update"), n >= e && (i = 0, x.remaining && !0 !== x.remaining && x.remaining--, x.remaining ? (o = u, B("loopComplete"), B("loopBegin"), "alternate" === x.direction && k()) : (x.paused = !0, x.completed || (x.completed = !0, B("loopComplete"), B("complete"), !x.passThrough && "Promise" in window && (c(), f(x)))))
    }
    return x.reset = function () {
      var n = x.direction;
      x.passThrough = !1, x.currentTime = 0, x.progress = 0, x.paused = !0, x.began = !1, x.changeBegan = !1, x.completed = !1, x.changeCompleted = !1, x.reversePlayback = !1, x.reversed = "reverse" === n, x.remaining = x.loop, t = x.children;
      for (var e = s = t.length; e--;) x.children[e].reset();
      (x.reversed && !0 !== x.loop || "alternate" === n && 1 === x.loop) && x.remaining++, I(0)
    }, x.set = function (n, e) {
      return G(n, e), x
    }, x.tick = function (n) {
      u = n, o || (o = u), D((u + (i - o)) * en.speed)
    }, x.seek = function (n) {
      D(C(n))
    }, x.pause = function () {
      x.paused = !0, O()
    }, x.play = function () {
      x.paused && (x.completed && x.reset(), x.paused = !1, U.push(x), O(), K || nn())
    }, x.reverse = function () {
      k(), O()
    }, x.restart = function () {
      x.reset(), x.play()
    }, x.reset(), x.autoplay && x.play(), x
  }

  function rn(n, e) {
    for (var r = e.length; r--;) b(n, e[r].animatable.target) && e.splice(r, 1)
  }
  return "undefined" != typeof document && document.addEventListener("visibilitychange", function () {
    document.hidden ? (U.forEach(function (n) {
      return n.pause()
    }), _ = U.slice(0), U = []) : _.forEach(function (n) {
      return n.play()
    })
  }), en.version = "3.0.1", en.speed = 1, en.running = U, en.remove = function (n) {
    for (var e = Y(n), r = U.length; r--;) {
      var t = U[r],
        a = t.animations,
        o = t.children;
      rn(e, a);
      for (var i = o.length; i--;) {
        var u = o[i],
          s = u.animations;
        rn(e, s), s.length || u.children.length || o.splice(i, 1)
      }
      a.length || o.length || t.pause()
    }
  }, en.get = N, en.set = G, en.convertPx = I, en.path = function (n, e) {
    var r = u.str(n) ? h(n)[0] : n,
      t = e || 100;
    return function (n) {
      return {
        property: n,
        el: r,
        svg: q(r),
        totalLength: j(r) * (t / 100)
      }
    }
  }, en.setDashoffset = function (n) {
    var e = j(n);
    return n.setAttribute("stroke-dasharray", e), e
  }, en.stagger = function (n, e) {
    void 0 === e && (e = {});
    var r = e.direction || "normal",
      t = e.easing ? v(e.easing) : null,
      a = e.grid,
      o = e.axis,
      i = e.from || 0,
      s = "first" === i,
      c = "center" === i,
      f = "last" === i,
      l = u.arr(n),
      d = l ? parseFloat(n[0]) : parseFloat(n),
      p = l ? parseFloat(n[1]) : 0,
      h = C(l ? n[1] : n) || 0,
      g = e.start || 0 + (l ? d : 0),
      m = [],
      y = 0;
    return function (n, e, u) {
      if (s && (i = 0), c && (i = (u - 1) / 2), f && (i = u - 1), !m.length) {
        for (var v = 0; v < u; v++) {
          if (a) {
            var b = c ? (a[0] - 1) / 2 : i % a[0],
              x = c ? (a[1] - 1) / 2 : Math.floor(i / a[0]),
              M = b - v % a[0],
              w = x - Math.floor(v / a[0]),
              k = Math.sqrt(M * M + w * w);
            "x" === o && (k = -M), "y" === o && (k = -w), m.push(k)
          } else m.push(Math.abs(i - v));
          y = Math.max.apply(Math, m)
        }
        t && (m = m.map(function (n) {
          return t(n / y) * y
        })), "reverse" === r && (m = m.map(function (n) {
          return o ? n < 0 ? -1 * n : -n : Math.abs(y - n)
        }))
      }
      return g + (l ? (p - d) / y : d) * (Math.round(100 * m[e]) / 100) + h
    }
  }, en.timeline = function (n) {
    void 0 === n && (n = {});
    var r = en(n);
    return r.duration = 0, r.add = function (t, a) {
      var o = U.indexOf(r),
        i = r.children;

      function s(n) {
        n.passThrough = !0
      }
      o > -1 && U.splice(o, 1);
      for (var c = 0; c < i.length; c++) s(i[c]);
      var f = w(t, M(e, n));
      f.targets = f.targets || n.targets;
      var l = r.duration;
      f.autoplay = !1, f.direction = r.direction, f.timelineOffset = u.und(a) ? l : A(a, l), s(r), r.seek(f.timelineOffset);
      var d = en(f);
      s(d), i.push(d);
      var p = W(i, n);
      return r.delay = p.delay, r.endDelay = p.endDelay, r.duration = p.duration, r.seek(0), r.reset(), r.autoplay && r.play(), r
    }, r
  }, en.easing = v, en.penner = p, en.random = function (n, e) {
    return Math.floor(Math.random() * (e - n + 1)) + n
  }, en
}); /*! elementor - v3.0.2 - 26-08-2020 */
! function (t) {
  var e = {};

  function __webpack_require__(n) {
    if (e[n]) return e[n].exports;
    var r = e[n] = {
      i: n,
      l: !1,
      exports: {}
    };
    return t[n].call(r.exports, r, r.exports, __webpack_require__), r.l = !0, r.exports
  }
  __webpack_require__.m = t, __webpack_require__.c = e, __webpack_require__.d = function (t, e, n) {
    __webpack_require__.o(t, e) || Object.defineProperty(t, e, {
      enumerable: !0,
      get: n
    })
  }, __webpack_require__.r = function (t) {
    "undefined" != typeof Symbol && Symbol.toStringTag && Object.defineProperty(t, Symbol.toStringTag, {
      value: "Module"
    }), Object.defineProperty(t, "__esModule", {
      value: !0
    })
  }, __webpack_require__.t = function (t, e) {
    if (1 & e && (t = __webpack_require__(t)), 8 & e) return t;
    if (4 & e && "object" == typeof t && t && t.__esModule) return t;
    var n = Object.create(null);
    if (__webpack_require__.r(n), Object.defineProperty(n, "default", {
      enumerable: !0,
      value: t
    }), 2 & e && "string" != typeof t)
      for (var r in t) __webpack_require__.d(n, r, function (e) {
        return t[e]
      }.bind(null, r));
    return n
  }, __webpack_require__.n = function (t) {
    var e = t && t.__esModule ? function getDefault() {
      return t.default
    } : function getModuleExports() {
      return t
    };
    return __webpack_require__.d(e, "a", e), e
  }, __webpack_require__.o = function (t, e) {
    return Object.prototype.hasOwnProperty.call(t, e)
  }, __webpack_require__.p = "", __webpack_require__(__webpack_require__.s = 918)
}([function (t, e) {
  t.exports = function _interopRequireDefault(t) {
    return t && t.__esModule ? t : {
      default: t
    }
  }
}, function (t, e, n) {
  t.exports = n(155)
}, function (t, e) {
  t.exports = function _classCallCheck(t, e) {
    if (!(t instanceof e)) throw new TypeError("Cannot call a class as a function")
  }
}, function (t, e, n) {
  var r = n(1);

  function _defineProperties(t, e) {
    for (var n = 0; n < e.length; n++) {
      var o = e[n];
      o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), r(t, o.key, o)
    }
  }
  t.exports = function _createClass(t, e, n) {
    return e && _defineProperties(t.prototype, e), n && _defineProperties(t, n), t
  }
}, function (t, e, n) {
  var r = n(137),
    o = n(135);
  t.exports = function _inherits(t, e) {
    if ("function" != typeof e && null !== e) throw new TypeError("Super expression must either be null or a function");
    t.prototype = r(e && e.prototype, {
      constructor: {
        value: t,
        writable: !0,
        configurable: !0
      }
    }), e && o(t, e)
  }
}, function (t, e, n) {
  var r = n(107),
    o = n(16),
    i = n(148),
    u = n(170);
  t.exports = function _createSuper(t) {
    var e = i();
    return function _createSuperInternal() {
      var n, i = o(t);
      if (e) {
        var c = o(this).constructor;
        n = r(i, arguments, c)
      } else n = i.apply(this, arguments);
      return u(this, n)
    }
  }
}, function (t, e) {
  var n = t.exports = {
    version: "2.6.11"
  };
  "number" == typeof __e && (__e = n)
}, function (t, e, n) {
  var r = n(8),
    o = n(6),
    i = n(31),
    u = n(24),
    c = n(19),
    $export = function (t, e, n) {
      var s, a, f, l = t & $export.F,
        p = t & $export.G,
        v = t & $export.S,
        d = t & $export.P,
        h = t & $export.B,
        g = t & $export.W,
        y = p ? o : o[e] || (o[e] = {}),
        m = y.prototype,
        _ = p ? r : v ? r[e] : (r[e] || {}).prototype;
      for (s in p && (n = e), n) (a = !l && _ && void 0 !== _[s]) && c(y, s) || (f = a ? _[s] : n[s], y[s] = p && "function" != typeof _[s] ? n[s] : h && a ? i(f, r) : g && _[s] == f ? function (t) {
        var F = function (e, n, r) {
          if (this instanceof t) {
            switch (arguments.length) {
              case 0:
                return new t;
              case 1:
                return new t(e);
              case 2:
                return new t(e, n)
            }
            return new t(e, n, r)
          }
          return t.apply(this, arguments)
        };
        return F.prototype = t.prototype, F
      }(f) : d && "function" == typeof f ? i(Function.call, f) : f, d && ((y.virtual || (y.virtual = {}))[s] = f, t & $export.R && m && !m[s] && u(m, s, f)))
    };
  $export.F = 1, $export.G = 2, $export.S = 4, $export.P = 8, $export.B = 16, $export.W = 32, $export.U = 64, $export.R = 128, t.exports = $export
}, function (t, e) {
  var n = t.exports = "undefined" != typeof window && window.Math == Math ? window : "undefined" != typeof self && self.Math == Math ? self : Function("return this")();
  "number" == typeof __g && (__g = n)
}, function (t, e) {
  t.exports = function (t) {
    return "object" == typeof t ? null !== t : "function" == typeof t
  }
}, function (t, e, n) {
  var r = n(76)("wks"),
    o = n(59),
    i = n(8).Symbol,
    u = "function" == typeof i;
  (t.exports = function (t) {
    return r[t] || (r[t] = u && i[t] || (u ? i : o)("Symbol." + t))
  }).store = r
}, , function (t, e, n) {
  var r = n(66)("wks"),
    o = n(67),
    i = n(17).Symbol,
    u = "function" == typeof i;
  (t.exports = function (t) {
    return r[t] || (r[t] = u && i[t] || (u ? i : o)("Symbol." + t))
  }).store = r
}, function (t, e, n) {
  var r = n(9);
  t.exports = function (t) {
    if (!r(t)) throw TypeError(t + " is not an object!");
    return t
  }
}, function (t, e, n) {
  t.exports = !n(22)((function () {
    return 7 != Object.defineProperty({}, "a", {
      get: function () {
        return 7
      }
    }).a
  }))
}, function (t, e, n) {
  var r = n(13),
    o = n(114),
    i = n(74),
    u = Object.defineProperty;
  e.f = n(14) ? Object.defineProperty : function defineProperty(t, e, n) {
    if (r(t), e = i(e, !0), r(n), o) try {
      return u(t, e, n)
    } catch (t) { }
    if ("get" in n || "set" in n) throw TypeError("Accessors not supported!");
    return "value" in n && (t[e] = n.value), t
  }
}, function (t, e, n) {
  var r = n(157),
    o = n(115);

  function _getPrototypeOf(e) {
    return t.exports = _getPrototypeOf = o ? r : function _getPrototypeOf(t) {
      return t.__proto__ || r(t)
    }, _getPrototypeOf(e)
  }
  t.exports = _getPrototypeOf
}, function (t, e) {
  var n = t.exports = "undefined" != typeof window && window.Math == Math ? window : "undefined" != typeof self && self.Math == Math ? self : Function("return this")();
  "number" == typeof __g && (__g = n)
}, function (t, e, n) {
  var r = n(30);
  t.exports = function (t) {
    if (!r(t)) throw TypeError(t + " is not an object!");
    return t
  }
}, function (t, e) {
  var n = {}.hasOwnProperty;
  t.exports = function (t, e) {
    return n.call(t, e)
  }
}, function (t, e, n) {
  var r = n(103),
    o = n(65);
  t.exports = function (t) {
    return r(o(t))
  }
}, , function (t, e) {
  t.exports = function (t) {
    try {
      return !!t()
    } catch (t) {
      return !0
    }
  }
}, function (t, e, n) {
  t.exports = n(201)
}, function (t, e, n) {
  var r = n(15),
    o = n(44);
  t.exports = n(14) ? function (t, e, n) {
    return r.f(t, e, o(1, n))
  } : function (t, e, n) {
    return t[e] = n, t
  }
}, function (t, e, n) {
  var r = n(124),
    o = n(193),
    i = n(196);

  function _get(e, n, u) {
    return "undefined" != typeof Reflect && o ? t.exports = _get = o : t.exports = _get = function _get(t, e, n) {
      var o = i(t, e);
      if (o) {
        var u = r(o, e);
        return u.get ? u.get.call(n) : u.value
      }
    }, _get(e, n, u || e)
  }
  t.exports = _get
}, function (t, e, n) {
  "use strict";
  var r = n(37),
    o = n(181)(5),
    i = !0;
  "find" in [] && Array(1).find((function () {
    i = !1
  })), r(r.P + r.F * i, "Array", {
    find: function find(t) {
      return o(this, t, arguments.length > 1 ? arguments[1] : void 0)
    }
  }), n(85)("find")
}, function (t, e, n) {
  t.exports = !n(33)((function () {
    return 7 != Object.defineProperty({}, "a", {
      get: function () {
        return 7
      }
    }).a
  }))
}, , function (t, e, n) {
  var r = n(45),
    o = n(102);
  t.exports = n(27) ? function (t, e, n) {
    return r.f(t, e, o(1, n))
  } : function (t, e, n) {
    return t[e] = n, t
  }
}, function (t, e) {
  t.exports = function (t) {
    return "object" == typeof t ? null !== t : "function" == typeof t
  }
}, function (t, e, n) {
  var r = n(38);
  t.exports = function (t, e, n) {
    if (r(t), void 0 === e) return t;
    switch (n) {
      case 1:
        return function (n) {
          return t.call(e, n)
        };
      case 2:
        return function (n, r) {
          return t.call(e, n, r)
        };
      case 3:
        return function (n, r, o) {
          return t.call(e, n, r, o)
        }
    }
    return function () {
      return t.apply(e, arguments)
    }
  }
}, function (t, e, n) {
  var r = n(65);
  t.exports = function (t) {
    return Object(r(t))
  }
}, function (t, e) {
  t.exports = function (t) {
    try {
      return !!t()
    } catch (t) {
      return !0
    }
  }
}, function (t, e) {
  t.exports = {}
}, function (t, e, n) {
  var r = n(17),
    o = n(29),
    i = n(61),
    u = n(67)("src"),
    c = n(143),
    s = ("" + c).split("toString");
  n(55).inspectSource = function (t) {
    return c.call(t)
  }, (t.exports = function (t, e, n, c) {
    var a = "function" == typeof n;
    a && (i(n, "name") || o(n, "name", e)), t[e] !== n && (a && (i(n, u) || o(n, u, t[e] ? "" + t[e] : s.join(String(e)))), t === r ? t[e] = n : c ? t[e] ? t[e] = n : o(t, e, n) : (delete t[e], o(t, e, n)))
  })(Function.prototype, "toString", (function toString() {
    return "function" == typeof this && this[u] || c.call(this)
  }))
}, , function (t, e, n) {
  var r = n(17),
    o = n(55),
    i = n(29),
    u = n(35),
    c = n(73),
    $export = function (t, e, n) {
      var s, a, f, l, p = t & $export.F,
        v = t & $export.G,
        d = t & $export.S,
        h = t & $export.P,
        g = t & $export.B,
        y = v ? r : d ? r[e] || (r[e] = {}) : (r[e] || {}).prototype,
        m = v ? o : o[e] || (o[e] = {}),
        _ = m.prototype || (m.prototype = {});
      for (s in v && (n = e), n) f = ((a = !p && y && void 0 !== y[s]) ? y : n)[s], l = g && a ? c(f, r) : h && "function" == typeof f ? c(Function.call, f) : f, y && u(y, s, f, t & $export.U), m[s] != f && i(m, s, l), h && _[s] != f && (_[s] = f)
    };
  r.core = o, $export.F = 1, $export.G = 2, $export.S = 4, $export.P = 8, $export.B = 16, $export.W = 32, $export.U = 64, $export.R = 128, t.exports = $export
}, function (t, e) {
  t.exports = function (t) {
    if ("function" != typeof t) throw TypeError(t + " is not a function!");
    return t
  }
}, function (t, e, n) {
  var r = n(45).f,
    o = Function.prototype,
    i = /^\s*function ([^ (]*)/;
  "name" in o || n(27) && r(o, "name", {
    configurable: !0,
    get: function () {
      try {
        return ("" + this).match(i)[1]
      } catch (t) {
        return ""
      }
    }
  })
}, function (t, e, n) {
  var r = n(116),
    o = n(78);
  t.exports = Object.keys || function keys(t) {
    return r(t, o)
  }
}, , function (t, e) {
  t.exports = function (t) {
    if (null == t) throw TypeError("Can't call method on  " + t);
    return t
  }
}, function (t, e, n) {
  var r = n(57),
    o = Math.min;
  t.exports = function (t) {
    return t > 0 ? o(r(t), 9007199254740991) : 0
  }
}, function (t, e) {
  t.exports = function (t, e) {
    return {
      enumerable: !(1 & t),
      configurable: !(2 & t),
      writable: !(4 & t),
      value: e
    }
  }
}, function (t, e, n) {
  var r = n(18),
    o = n(129),
    i = n(123),
    u = Object.defineProperty;
  e.f = n(27) ? Object.defineProperty : function defineProperty(t, e, n) {
    if (r(t), e = i(e, !0), r(n), o) try {
      return u(t, e, n)
    } catch (t) { }
    if ("get" in n || "set" in n) throw TypeError("Accessors not supported!");
    return "value" in n && (t[e] = n.value), t
  }
}, function (t, e) {
  var n = {}.toString;
  t.exports = function (t) {
    return n.call(t).slice(8, -1)
  }
}, function (t, e) {
  t.exports = !0
}, function (t, e, n) {
  var r = n(151),
    o = n(111);

  function _typeof(e) {
    return t.exports = _typeof = "function" == typeof o && "symbol" == typeof r ? function _typeof(t) {
      return typeof t
    } : function _typeof(t) {
      return t && "function" == typeof o && t.constructor === o && t !== o.prototype ? "symbol" : typeof t
    }, _typeof(e)
  }
  t.exports = _typeof
}, function (t, e) {
  t.exports = function _assertThisInitialized(t) {
    if (void 0 === t) throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    return t
  }
}, function (t, e) {
  e.f = {}.propertyIsEnumerable
}, function (t, e, n) {
  var r = n(50),
    o = n(44),
    i = n(20),
    u = n(74),
    c = n(19),
    s = n(114),
    a = Object.getOwnPropertyDescriptor;
  e.f = n(14) ? a : function getOwnPropertyDescriptor(t, e) {
    if (t = i(t), e = u(e, !0), s) try {
      return a(t, e)
    } catch (t) { }
    if (c(t, e)) return o(!r.f.call(t, e), t[e])
  }
}, function (t, e, n) {
  var r = n(13),
    o = n(134),
    i = n(78),
    u = n(75)("IE_PROTO"),
    Empty = function () { },
    createDict = function () {
      var t, e = n(92)("iframe"),
        r = i.length;
      for (e.style.display = "none", n(131).appendChild(e), e.src = "javascript:", (t = e.contentWindow.document).open(), t.write("<script>document.F=Object<\/script>"), t.close(), createDict = t.F; r--;) delete createDict.prototype[i[r]];
      return createDict()
    };
  t.exports = Object.create || function create(t, e) {
    var n;
    return null !== t ? (Empty.prototype = r(t), n = new Empty, Empty.prototype = null, n[u] = t) : n = createDict(), void 0 === e ? n : o(n, e)
  }
}, function (t, e, n) {
  var r = n(15).f,
    o = n(19),
    i = n(10)("toStringTag");
  t.exports = function (t, e, n) {
    t && !o(t = n ? t : t.prototype, i) && r(t, i, {
      configurable: !0,
      value: e
    })
  }
}, , function (t, e) {
  var n = t.exports = {
    version: "2.6.11"
  };
  "number" == typeof __e && (__e = n)
}, function (t, e) {
  var n = {}.toString;
  t.exports = function (t) {
    return n.call(t).slice(8, -1)
  }
}, function (t, e) {
  var n = Math.ceil,
    r = Math.floor;
  t.exports = function (t) {
    return isNaN(t = +t) ? 0 : (t > 0 ? r : n)(t)
  }
}, , function (t, e) {
  var n = 0,
    r = Math.random();
  t.exports = function (t) {
    return "Symbol(".concat(void 0 === t ? "" : t, ")_", (++n + r).toString(36))
  }
}, function (t, e, n) {
  "use strict";
  var r = n(172)(!0);
  n(108)(String, "String", (function (t) {
    this._t = String(t), this._i = 0
  }), (function () {
    var t, e = this._t,
      n = this._i;
    return n >= e.length ? {
      value: void 0,
      done: !0
    } : (t = r(e, n), this._i += t.length, {
      value: t,
      done: !1
    })
  }))
}, function (t, e) {
  var n = {}.hasOwnProperty;
  t.exports = function (t, e) {
    return n.call(t, e)
  }
}, function (t, e, n) {
  n(174);
  for (var r = n(8), o = n(24), i = n(34), u = n(10)("toStringTag"), c = "CSSRuleList,CSSStyleDeclaration,CSSValueList,ClientRectList,DOMRectList,DOMStringList,DOMTokenList,DataTransferItemList,FileList,HTMLAllCollection,HTMLCollection,HTMLFormElement,HTMLSelectElement,MediaList,MimeTypeArray,NamedNodeMap,NodeList,PaintRequestList,Plugin,PluginArray,SVGLengthList,SVGNumberList,SVGPathSegList,SVGPointList,SVGStringList,SVGTransformList,SourceBufferList,StyleSheetList,TextTrackCueList,TextTrackList,TouchList".split(","), s = 0; s < c.length; s++) {
    var a = c[s],
      f = r[a],
      l = f && f.prototype;
    l && !l[u] && o(l, u, a), i[a] = i.Array
  }
}, function (t, e, n) {
  e.f = n(10)
}, function (t, e, n) {
  var r = n(19),
    o = n(32),
    i = n(75)("IE_PROTO"),
    u = Object.prototype;
  t.exports = Object.getPrototypeOf || function (t) {
    return t = o(t), r(t, i) ? t[i] : "function" == typeof t.constructor && t instanceof t.constructor ? t.constructor.prototype : t instanceof Object ? u : null
  }
}, function (t, e) {
  t.exports = function (t) {
    if (null == t) throw TypeError("Can't call method on  " + t);
    return t
  }
}, function (t, e, n) {
  var r = n(55),
    o = n(17),
    i = o["__core-js_shared__"] || (o["__core-js_shared__"] = {});
  (t.exports = function (t, e) {
    return i[t] || (i[t] = void 0 !== e ? e : {})
  })("versions", []).push({
    version: r.version,
    mode: n(110) ? "pure" : "global",
    copyright: "© 2019 Denis Pushkarev (zloirock.ru)"
  })
}, function (t, e) {
  var n = 0,
    r = Math.random();
  t.exports = function (t) {
    return "Symbol(".concat(void 0 === t ? "" : t, ")_", (++n + r).toString(36))
  }
}, function (t, e, n) {
  var r = n(77),
    o = Math.min;
  t.exports = function (t) {
    return t > 0 ? o(r(t), 9007199254740991) : 0
  }
}, , function (t, e, n) {
  var r = n(59)("meta"),
    o = n(9),
    i = n(19),
    u = n(15).f,
    c = 0,
    s = Object.isExtensible || function () {
      return !0
    },
    a = !n(22)((function () {
      return s(Object.preventExtensions({}))
    })),
    setMeta = function (t) {
      u(t, r, {
        value: {
          i: "O" + ++c,
          w: {}
        }
      })
    },
    f = t.exports = {
      KEY: r,
      NEED: !1,
      fastKey: function (t, e) {
        if (!o(t)) return "symbol" == typeof t ? t : ("string" == typeof t ? "S" : "P") + t;
        if (!i(t, r)) {
          if (!s(t)) return "F";
          if (!e) return "E";
          setMeta(t)
        }
        return t[r].i
      },
      getWeak: function (t, e) {
        if (!i(t, r)) {
          if (!s(t)) return !0;
          if (!e) return !1;
          setMeta(t)
        }
        return t[r].w
      },
      onFreeze: function (t) {
        return a && f.NEED && s(t) && !i(t, r) && setMeta(t), t
      }
    }
}, function (t, e) {
  e.f = Object.getOwnPropertySymbols
}, function (t, e, n) {
  "use strict";
  var r = n(113),
    o = {};
  o[n(12)("toStringTag")] = "z", o + "" != "[object z]" && n(35)(Object.prototype, "toString", (function toString() {
    return "[object " + r(this) + "]"
  }), !0)
}, function (t, e, n) {
  var r = n(91);
  t.exports = function (t, e, n) {
    if (r(t), void 0 === e) return t;
    switch (n) {
      case 1:
        return function (n) {
          return t.call(e, n)
        };
      case 2:
        return function (n, r) {
          return t.call(e, n, r)
        };
      case 3:
        return function (n, r, o) {
          return t.call(e, n, r, o)
        }
    }
    return function () {
      return t.apply(e, arguments)
    }
  }
}, function (t, e, n) {
  var r = n(9);
  t.exports = function (t, e) {
    if (!r(t)) return t;
    var n, o;
    if (e && "function" == typeof (n = t.toString) && !r(o = n.call(t))) return o;
    if ("function" == typeof (n = t.valueOf) && !r(o = n.call(t))) return o;
    if (!e && "function" == typeof (n = t.toString) && !r(o = n.call(t))) return o;
    throw TypeError("Can't convert object to primitive value")
  }
}, function (t, e, n) {
  var r = n(76)("keys"),
    o = n(59);
  t.exports = function (t) {
    return r[t] || (r[t] = o(t))
  }
}, function (t, e, n) {
  var r = n(6),
    o = n(8),
    i = o["__core-js_shared__"] || (o["__core-js_shared__"] = {});
  (t.exports = function (t, e) {
    return i[t] || (i[t] = void 0 !== e ? e : {})
  })("versions", []).push({
    version: r.version,
    mode: n(47) ? "pure" : "global",
    copyright: "© 2019 Denis Pushkarev (zloirock.ru)"
  })
}, function (t, e) {
  var n = Math.ceil,
    r = Math.floor;
  t.exports = function (t) {
    return isNaN(t = +t) ? 0 : (t > 0 ? r : n)(t)
  }
}, function (t, e) {
  t.exports = "constructor,hasOwnProperty,isPrototypeOf,propertyIsEnumerable,toLocaleString,toString,valueOf".split(",")
}, function (t, e, n) {
  var r = n(8),
    o = n(6),
    i = n(47),
    u = n(63),
    c = n(15).f;
  t.exports = function (t) {
    var e = o.Symbol || (o.Symbol = i ? {} : r.Symbol || {});
    "_" == t.charAt(0) || t in e || c(e, t, {
      value: u.f(t)
    })
  }
}, function (t, e, n) {
  "use strict";
  var r = n(122),
    o = n(18),
    i = n(154),
    u = n(105),
    c = n(43),
    s = n(94),
    a = n(88),
    f = n(33),
    l = Math.min,
    p = [].push,
    v = "length",
    d = !f((function () {
      RegExp(4294967295, "y")
    }));
  n(95)("split", 2, (function (t, e, n, f) {
    var h;
    return h = "c" == "abbc".split(/(b)*/)[1] || 4 != "test".split(/(?:)/, -1)[v] || 2 != "ab".split(/(?:ab)*/)[v] || 4 != ".".split(/(.?)(.?)/)[v] || ".".split(/()()/)[v] > 1 || "".split(/.?/)[v] ? function (t, e) {
      var o = String(this);
      if (void 0 === t && 0 === e) return [];
      if (!r(t)) return n.call(o, t, e);
      for (var i, u, c, s = [], f = (t.ignoreCase ? "i" : "") + (t.multiline ? "m" : "") + (t.unicode ? "u" : "") + (t.sticky ? "y" : ""), l = 0, d = void 0 === e ? 4294967295 : e >>> 0, h = new RegExp(t.source, f + "g");
        (i = a.call(h, o)) && !((u = h.lastIndex) > l && (s.push(o.slice(l, i.index)), i[v] > 1 && i.index < o[v] && p.apply(s, i.slice(1)), c = i[0][v], l = u, s[v] >= d));) h.lastIndex === i.index && h.lastIndex++;
      return l === o[v] ? !c && h.test("") || s.push("") : s.push(o.slice(l)), s[v] > d ? s.slice(0, d) : s
    } : "0".split(void 0, 0)[v] ? function (t, e) {
      return void 0 === t && 0 === e ? [] : n.call(this, t, e)
    } : n, [function split(n, r) {
      var o = t(this),
        i = null == n ? void 0 : n[e];
      return void 0 !== i ? i.call(n, o, r) : h.call(String(o), n, r)
    }, function (t, e) {
      var r = f(h, t, this, e, h !== n);
      if (r.done) return r.value;
      var a = o(t),
        p = String(this),
        v = i(a, RegExp),
        g = a.unicode,
        y = (a.ignoreCase ? "i" : "") + (a.multiline ? "m" : "") + (a.unicode ? "u" : "") + (d ? "y" : "g"),
        m = new v(d ? a : "^(?:" + a.source + ")", y),
        _ = void 0 === e ? 4294967295 : e >>> 0;
      if (0 === _) return [];
      if (0 === p.length) return null === s(m, p) ? [p] : [];
      for (var x = 0, b = 0, S = []; b < p.length;) {
        m.lastIndex = d ? b : 0;
        var w, O = s(m, d ? p : p.slice(b));
        if (null === O || (w = l(c(m.lastIndex + (d ? 0 : b)), p.length)) === x) b = u(p, b, g);
        else {
          if (S.push(p.slice(x, b)), S.length === _) return S;
          for (var E = 1; E <= O.length - 1; E++)
            if (S.push(O[E]), S.length === _) return S;
          b = x = w
        }
      }
      return S.push(p.slice(x)), S
    }]
  }))
}, function (t, e, n) {
  t.exports = n(220)
}, , function (t, e, n) {
  var r = n(7),
    o = n(6),
    i = n(22);
  t.exports = function (t, e) {
    var n = (o.Object || {})[t] || Object[t],
      u = {};
    u[t] = e(n), r(r.S + r.F * i((function () {
      n(1)
    })), "Object", u)
  }
}, , function (t, e, n) {
  var r = n(12)("unscopables"),
    o = Array.prototype;
  null == o[r] && n(29)(o, r, {}), t.exports = function (t) {
    o[r][t] = !0
  }
}, function (t, e, n) {
  var r = n(31),
    o = n(139),
    i = n(140),
    u = n(13),
    c = n(68),
    s = n(112),
    a = {},
    f = {};
  (e = t.exports = function (t, e, n, l, p) {
    var v, d, h, g, y = p ? function () {
      return t
    } : s(t),
      m = r(n, l, e ? 2 : 1),
      _ = 0;
    if ("function" != typeof y) throw TypeError(t + " is not iterable!");
    if (i(y)) {
      for (v = c(t.length); v > _; _++)
        if ((g = e ? m(u(d = t[_])[0], d[1]) : m(t[_])) === a || g === f) return g
    } else
      for (h = y.call(t); !(d = h.next()).done;)
        if ((g = o(h, m, d.value, e)) === a || g === f) return g
  }).BREAK = a, e.RETURN = f
}, , function (t, e, n) {
  "use strict";
  var r, o, i = n(106),
    u = RegExp.prototype.exec,
    c = String.prototype.replace,
    s = u,
    a = (r = /a/, o = /b*/g, u.call(r, "a"), u.call(o, "a"), 0 !== r.lastIndex || 0 !== o.lastIndex),
    f = void 0 !== /()??/.exec("")[1];
  (a || f) && (s = function exec(t) {
    var e, n, r, o, s = this;
    return f && (n = new RegExp("^" + s.source + "$(?!\\s)", i.call(s))), a && (e = s.lastIndex), r = u.call(s, t), a && r && (s.lastIndex = s.global ? r.index + r[0].length : e), f && r && r.length > 1 && c.call(r[0], n, (function () {
      for (o = 1; o < arguments.length - 2; o++) void 0 === arguments[o] && (r[o] = void 0)
    })), r
  }), t.exports = s
}, , , function (t, e) {
  t.exports = function (t) {
    if ("function" != typeof t) throw TypeError(t + " is not a function!");
    return t
  }
}, function (t, e, n) {
  var r = n(9),
    o = n(8).document,
    i = r(o) && r(o.createElement);
  t.exports = function (t) {
    return i ? o.createElement(t) : {}
  }
}, function (t, e, n) {
  t.exports = n(24)
}, function (t, e, n) {
  "use strict";
  var r = n(113),
    o = RegExp.prototype.exec;
  t.exports = function (t, e) {
    var n = t.exec;
    if ("function" == typeof n) {
      var i = n.call(t, e);
      if ("object" != typeof i) throw new TypeError("RegExp exec method returned something other than an Object or null");
      return i
    }
    if ("RegExp" !== r(t)) throw new TypeError("RegExp#exec called on incompatible receiver");
    return o.call(t, e)
  }
}, function (t, e, n) {
  "use strict";
  n(190);
  var r = n(35),
    o = n(29),
    i = n(33),
    u = n(42),
    c = n(12),
    s = n(88),
    a = c("species"),
    f = !i((function () {
      var t = /./;
      return t.exec = function () {
        var t = [];
        return t.groups = {
          a: "7"
        }, t
      }, "7" !== "".replace(t, "$<a>")
    })),
    l = function () {
      var t = /(?:)/,
        e = t.exec;
      t.exec = function () {
        return e.apply(this, arguments)
      };
      var n = "ab".split(t);
      return 2 === n.length && "a" === n[0] && "b" === n[1]
    }();
  t.exports = function (t, e, n) {
    var p = c(t),
      v = !i((function () {
        var e = {};
        return e[p] = function () {
          return 7
        }, 7 != ""[t](e)
      })),
      d = v ? !i((function () {
        var e = !1,
          n = /a/;
        return n.exec = function () {
          return e = !0, null
        }, "split" === t && (n.constructor = {}, n.constructor[a] = function () {
          return n
        }), n[p](""), !e
      })) : void 0;
    if (!v || !d || "replace" === t && !f || "split" === t && !l) {
      var h = /./[p],
        g = n(u, p, ""[t], (function maybeCallNative(t, e, n, r, o) {
          return e.exec === s ? v && !o ? {
            done: !0,
            value: h.call(e, n, r)
          } : {
              done: !0,
              value: t.call(n, e, r)
            } : {
              done: !1
            }
        })),
        y = g[0],
        m = g[1];
      r(String.prototype, t, y), o(RegExp.prototype, p, 2 == e ? function (t, e) {
        return m.call(t, this, e)
      } : function (t) {
        return m.call(t, this)
      })
    }
  }
}, function (t, e, n) {
  var r = n(42);
  t.exports = function (t) {
    return Object(r(t))
  }
}, function (t, e, n) {
  var r = n(56);
  t.exports = Array.isArray || function isArray(t) {
    return "Array" == r(t)
  }
}, function (t, e, n) {
  var r = n(120),
    o = n(42);
  t.exports = function (t) {
    return r(o(t))
  }
}, function (t, e, n) {
  var r = n(116),
    o = n(78).concat("length", "prototype");
  e.f = Object.getOwnPropertyNames || function getOwnPropertyNames(t) {
    return r(t, o)
  }
}, function (t, e) { }, function (t, e, n) {
  var r = n(56),
    o = n(10)("toStringTag"),
    i = "Arguments" == r(function () {
      return arguments
    }());
  t.exports = function (t) {
    var e, n, u;
    return void 0 === t ? "Undefined" : null === t ? "Null" : "string" == typeof (n = function (t, e) {
      try {
        return t[e]
      } catch (t) { }
    }(e = Object(t), o)) ? n : i ? r(e) : "Object" == (u = r(e)) && "function" == typeof e.callee ? "Arguments" : u
  }
}, function (t, e) {
  t.exports = function (t, e) {
    return {
      enumerable: !(1 & t),
      configurable: !(2 & t),
      writable: !(4 & t),
      value: e
    }
  }
}, function (t, e, n) {
  var r = n(56);
  t.exports = Object("z").propertyIsEnumerable(0) ? Object : function (t) {
    return "String" == r(t) ? t.split("") : Object(t)
  }
}, , function (t, e, n) {
  "use strict";
  var r = n(142)(!0);
  t.exports = function (t, e, n) {
    return e + (n ? r(t, e).length : 1)
  }
}, function (t, e, n) {
  "use strict";
  var r = n(18);
  t.exports = function () {
    var t = r(this),
      e = "";
    return t.global && (e += "g"), t.ignoreCase && (e += "i"), t.multiline && (e += "m"), t.unicode && (e += "u"), t.sticky && (e += "y"), e
  }
}, function (t, e, n) {
  t.exports = n(167)
}, function (t, e, n) {
  "use strict";
  var r = n(47),
    o = n(7),
    i = n(93),
    u = n(24),
    c = n(34),
    s = n(173),
    a = n(53),
    f = n(64),
    l = n(10)("iterator"),
    p = !([].keys && "next" in [].keys()),
    returnThis = function () {
      return this
    };
  t.exports = function (t, e, n, v, d, h, g) {
    s(n, e, v);
    var y, m, _, getMethod = function (t) {
      if (!p && t in w) return w[t];
      switch (t) {
        case "keys":
          return function keys() {
            return new n(this, t)
          };
        case "values":
          return function values() {
            return new n(this, t)
          }
      }
      return function entries() {
        return new n(this, t)
      }
    },
      x = e + " Iterator",
      b = "values" == d,
      S = !1,
      w = t.prototype,
      O = w[l] || w["@@iterator"] || d && w[d],
      E = O || getMethod(d),
      I = d ? b ? getMethod("entries") : E : void 0,
      j = "Array" == e && w.entries || O;
    if (j && (_ = f(j.call(new t))) !== Object.prototype && _.next && (a(_, x, !0), r || "function" == typeof _[l] || u(_, l, returnThis)), b && O && "values" !== O.name && (S = !0, E = function values() {
      return O.call(this)
    }), r && !g || !p && !S && w[l] || u(w, l, E), c[e] = E, c[x] = returnThis, d)
      if (y = {
        values: b ? E : getMethod("values"),
        keys: h ? E : getMethod("keys"),
        entries: I
      }, g)
        for (m in y) m in w || i(w, m, y[m]);
      else o(o.P + o.F * (p || S), e, y);
    return y
  }
}, function (t, e, n) {
  var r = n(30),
    o = n(17).document,
    i = r(o) && r(o.createElement);
  t.exports = function (t) {
    return i ? o.createElement(t) : {}
  }
}, function (t, e) {
  t.exports = !1
}, function (t, e, n) {
  t.exports = n(176)
}, function (t, e, n) {
  var r = n(101),
    o = n(10)("iterator"),
    i = n(34);
  t.exports = n(6).getIteratorMethod = function (t) {
    if (null != t) return t[o] || t["@@iterator"] || i[r(t)]
  }
}, function (t, e, n) {
  var r = n(46),
    o = n(12)("toStringTag"),
    i = "Arguments" == r(function () {
      return arguments
    }());
  t.exports = function (t) {
    var e, n, u;
    return void 0 === t ? "Undefined" : null === t ? "Null" : "string" == typeof (n = function (t, e) {
      try {
        return t[e]
      } catch (t) { }
    }(e = Object(t), o)) ? n : i ? r(e) : "Object" == (u = r(e)) && "function" == typeof e.callee ? "Arguments" : u
  }
}, function (t, e, n) {
  t.exports = !n(14) && !n(22)((function () {
    return 7 != Object.defineProperty(n(92)("div"), "a", {
      get: function () {
        return 7
      }
    }).a
  }))
}, function (t, e, n) {
  t.exports = n(160)
}, function (t, e, n) {
  var r = n(19),
    o = n(20),
    i = n(165)(!1),
    u = n(75)("IE_PROTO");
  t.exports = function (t, e) {
    var n, c = o(t),
      s = 0,
      a = [];
    for (n in c) n != u && r(c, n) && a.push(n);
    for (; e.length > s;) r(c, n = e[s++]) && (~i(a, n) || a.push(n));
    return a
  }
}, function (t, e, n) {
  "use strict";
  var r = n(85),
    o = n(241),
    i = n(118),
    u = n(98);
  t.exports = n(197)(Array, "Array", (function (t, e) {
    this._t = u(t), this._i = 0, this._k = e
  }), (function () {
    var t = this._t,
      e = this._k,
      n = this._i++;
    return !t || n >= t.length ? (this._t = void 0, o(1)) : o(0, "keys" == e ? n : "values" == e ? t[n] : [n, t[n]])
  }), "values"), i.Arguments = i.Array, r("keys"), r("values"), r("entries")
}, function (t, e) {
  t.exports = {}
}, , function (t, e, n) {
  var r = n(46);
  t.exports = Object("z").propertyIsEnumerable(0) ? Object : function (t) {
    return "String" == r(t) ? t.split("") : Object(t)
  }
}, function (t, e, n) {
  var r = n(9);
  t.exports = function (t, e) {
    if (!r(t) || t._t !== e) throw TypeError("Incompatible receiver, " + e + " required!");
    return t
  }
}, function (t, e, n) {
  var r = n(30),
    o = n(46),
    i = n(12)("match");
  t.exports = function (t) {
    var e;
    return r(t) && (void 0 !== (e = t[i]) ? !!e : "RegExp" == o(t))
  }
}, function (t, e, n) {
  var r = n(30);
  t.exports = function (t, e) {
    if (!r(t)) return t;
    var n, o;
    if (e && "function" == typeof (n = t.toString) && !r(o = n.call(t))) return o;
    if ("function" == typeof (n = t.valueOf) && !r(o = n.call(t))) return o;
    if (!e && "function" == typeof (n = t.toString) && !r(o = n.call(t))) return o;
    throw TypeError("Can't convert object to primitive value")
  }
}, function (t, e, n) {
  t.exports = n(191)
}, function (t, e) {
  t.exports = function (t, e, n, r) {
    if (!(t instanceof e) || void 0 !== r && r in t) throw TypeError(n + ": incorrect invocation!");
    return t
  }
}, function (t, e, n) {
  var r = n(24);
  t.exports = function (t, e, n) {
    for (var o in e) n && t[o] ? t[o] = e[o] : r(t, o, e[o]);
    return t
  }
}, , , function (t, e, n) {
  t.exports = !n(27) && !n(33)((function () {
    return 7 != Object.defineProperty(n(109)("div"), "a", {
      get: function () {
        return 7
      }
    }).a
  }))
}, function (t, e, n) {
  var r = n(66)("keys"),
    o = n(67);
  t.exports = function (t) {
    return r[t] || (r[t] = o(t))
  }
}, function (t, e, n) {
  var r = n(8).document;
  t.exports = r && r.documentElement
}, function (t, e) {
  t.exports = function (t, e, n) {
    var r = void 0 === n;
    switch (e.length) {
      case 0:
        return r ? t() : t.call(n);
      case 1:
        return r ? t(e[0]) : t.call(n, e[0]);
      case 2:
        return r ? t(e[0], e[1]) : t.call(n, e[0], e[1]);
      case 3:
        return r ? t(e[0], e[1], e[2]) : t.call(n, e[0], e[1], e[2]);
      case 4:
        return r ? t(e[0], e[1], e[2], e[3]) : t.call(n, e[0], e[1], e[2], e[3])
    }
    return t.apply(n, e)
  }
}, , function (t, e, n) {
  var r = n(15),
    o = n(13),
    i = n(40);
  t.exports = n(14) ? Object.defineProperties : function defineProperties(t, e) {
    o(t);
    for (var n, u = i(e), c = u.length, s = 0; c > s;) r.f(t, n = u[s++], e[n]);
    return t
  }
}, function (t, e, n) {
  var r = n(115);

  function _setPrototypeOf(e, n) {
    return t.exports = _setPrototypeOf = r || function _setPrototypeOf(t, e) {
      return t.__proto__ = e, t
    }, _setPrototypeOf(e, n)
  }
  t.exports = _setPrototypeOf
}, function (t, e, n) {
  var r = n(31),
    o = n(103),
    i = n(32),
    u = n(68),
    c = n(245);
  t.exports = function (t, e) {
    var n = 1 == t,
      s = 2 == t,
      a = 3 == t,
      f = 4 == t,
      l = 6 == t,
      p = 5 == t || l,
      v = e || c;
    return function (e, c, d) {
      for (var h, g, y = i(e), m = o(y), _ = r(c, d, 3), x = u(m.length), b = 0, S = n ? v(e, x) : s ? v(e, 0) : void 0; x > b; b++)
        if ((p || b in m) && (g = _(h = m[b], b, y), t))
          if (n) S[b] = g;
          else if (g) switch (t) {
            case 3:
              return !0;
            case 5:
              return h;
            case 6:
              return b;
            case 2:
              S.push(h)
          } else if (f) return !1;
      return l ? -1 : a || f ? f : S
    }
  }
}, function (t, e, n) {
  t.exports = n(163)
}, function (t, e, n) {
  "use strict";
  var r = n(8),
    o = n(19),
    i = n(14),
    u = n(7),
    c = n(93),
    s = n(70).KEY,
    a = n(22),
    f = n(76),
    l = n(53),
    p = n(59),
    v = n(10),
    d = n(63),
    h = n(79),
    g = n(177),
    y = n(97),
    m = n(13),
    _ = n(9),
    x = n(32),
    b = n(20),
    S = n(74),
    w = n(44),
    O = n(52),
    E = n(178),
    I = n(51),
    j = n(71),
    P = n(15),
    k = n(40),
    T = I.f,
    M = P.f,
    A = E.f,
    C = r.Symbol,
    L = r.JSON,
    D = L && L.stringify,
    N = v("_hidden"),
    R = v("toPrimitive"),
    $ = {}.propertyIsEnumerable,
    q = f("symbol-registry"),
    B = f("symbols"),
    H = f("op-symbols"),
    W = Object.prototype,
    G = "function" == typeof C && !!j.f,
    V = r.QObject,
    Q = !V || !V.prototype || !V.prototype.findChild,
    U = i && a((function () {
      return 7 != O(M({}, "a", {
        get: function () {
          return M(this, "a", {
            value: 7
          }).a
        }
      })).a
    })) ? function (t, e, n) {
      var r = T(W, e);
      r && delete W[e], M(t, e, n), r && t !== W && M(W, e, r)
    } : M,
    wrap = function (t) {
      var e = B[t] = O(C.prototype);
      return e._k = t, e
    },
    z = G && "symbol" == typeof C.iterator ? function (t) {
      return "symbol" == typeof t
    } : function (t) {
      return t instanceof C
    },
    J = function defineProperty(t, e, n) {
      return t === W && J(H, e, n), m(t), e = S(e, !0), m(n), o(B, e) ? (n.enumerable ? (o(t, N) && t[N][e] && (t[N][e] = !1), n = O(n, {
        enumerable: w(0, !1)
      })) : (o(t, N) || M(t, N, w(1, {})), t[N][e] = !0), U(t, e, n)) : M(t, e, n)
    },
    K = function defineProperties(t, e) {
      m(t);
      for (var n, r = g(e = b(e)), o = 0, i = r.length; i > o;) J(t, n = r[o++], e[n]);
      return t
    },
    Y = function propertyIsEnumerable(t) {
      var e = $.call(this, t = S(t, !0));
      return !(this === W && o(B, t) && !o(H, t)) && (!(e || !o(this, t) || !o(B, t) || o(this, N) && this[N][t]) || e)
    },
    X = function getOwnPropertyDescriptor(t, e) {
      if (t = b(t), e = S(e, !0), t !== W || !o(B, e) || o(H, e)) {
        var n = T(t, e);
        return !n || !o(B, e) || o(t, N) && t[N][e] || (n.enumerable = !0), n
      }
    },
    Z = function getOwnPropertyNames(t) {
      for (var e, n = A(b(t)), r = [], i = 0; n.length > i;) o(B, e = n[i++]) || e == N || e == s || r.push(e);
      return r
    },
    tt = function getOwnPropertySymbols(t) {
      for (var e, n = t === W, r = A(n ? H : b(t)), i = [], u = 0; r.length > u;) !o(B, e = r[u++]) || n && !o(W, e) || i.push(B[e]);
      return i
    };
  G || (c((C = function Symbol() {
    if (this instanceof C) throw TypeError("Symbol is not a constructor!");
    var t = p(arguments.length > 0 ? arguments[0] : void 0),
      $set = function (e) {
        this === W && $set.call(H, e), o(this, N) && o(this[N], t) && (this[N][t] = !1), U(this, t, w(1, e))
      };
    return i && Q && U(W, t, {
      configurable: !0,
      set: $set
    }), wrap(t)
  }).prototype, "toString", (function toString() {
    return this._k
  })), I.f = X, P.f = J, n(99).f = E.f = Z, n(50).f = Y, j.f = tt, i && !n(47) && c(W, "propertyIsEnumerable", Y, !0), d.f = function (t) {
    return wrap(v(t))
  }), u(u.G + u.W + u.F * !G, {
    Symbol: C
  });
  for (var et = "hasInstance,isConcatSpreadable,iterator,match,replace,search,species,split,toPrimitive,toStringTag,unscopables".split(","), nt = 0; et.length > nt;) v(et[nt++]);
  for (var rt = k(v.store), ot = 0; rt.length > ot;) h(rt[ot++]);
  u(u.S + u.F * !G, "Symbol", {
    for: function (t) {
      return o(q, t += "") ? q[t] : q[t] = C(t)
    },
    keyFor: function keyFor(t) {
      if (!z(t)) throw TypeError(t + " is not a symbol!");
      for (var e in q)
        if (q[e] === t) return e
    },
    useSetter: function () {
      Q = !0
    },
    useSimple: function () {
      Q = !1
    }
  }), u(u.S + u.F * !G, "Object", {
    create: function create(t, e) {
      return void 0 === e ? O(t) : K(O(t), e)
    },
    defineProperty: J,
    defineProperties: K,
    getOwnPropertyDescriptor: X,
    getOwnPropertyNames: Z,
    getOwnPropertySymbols: tt
  });
  var it = a((function () {
    j.f(1)
  }));
  u(u.S + u.F * it, "Object", {
    getOwnPropertySymbols: function getOwnPropertySymbols(t) {
      return j.f(x(t))
    }
  }), L && u(u.S + u.F * (!G || a((function () {
    var t = C();
    return "[null]" != D([t]) || "{}" != D({
      a: t
    }) || "{}" != D(Object(t))
  }))), "JSON", {
    stringify: function stringify(t) {
      for (var e, n, r = [t], o = 1; arguments.length > o;) r.push(arguments[o++]);
      if (n = e = r[1], (_(e) || void 0 !== t) && !z(t)) return y(e) || (e = function (t, e) {
        if ("function" == typeof n && (e = n.call(this, t, e)), !z(e)) return e
      }), r[1] = e, D.apply(L, r)
    }
  }), C.prototype[R] || n(24)(C.prototype, R, C.prototype.valueOf), l(C, "Symbol"), l(Math, "Math", !0), l(r.JSON, "JSON", !0)
}, function (t, e, n) {
  var r = n(13);
  t.exports = function (t, e, n, o) {
    try {
      return o ? e(r(n)[0], n[1]) : e(n)
    } catch (e) {
      var i = t.return;
      throw void 0 !== i && r(i.call(t)), e
    }
  }
}, function (t, e, n) {
  var r = n(34),
    o = n(10)("iterator"),
    i = Array.prototype;
  t.exports = function (t) {
    return void 0 !== t && (r.Array === t || i[o] === t)
  }
}, function (t, e, n) {
  "use strict";
  var r = n(37),
    o = n(146)(!0);
  r(r.P, "Array", {
    includes: function includes(t) {
      return o(this, t, arguments.length > 1 ? arguments[1] : void 0)
    }
  }), n(85)("includes")
}, function (t, e, n) {
  var r = n(57),
    o = n(42);
  t.exports = function (t) {
    return function (e, n) {
      var i, u, c = String(o(e)),
        s = r(n),
        a = c.length;
      return s < 0 || s >= a ? t ? "" : void 0 : (i = c.charCodeAt(s)) < 55296 || i > 56319 || s + 1 === a || (u = c.charCodeAt(s + 1)) < 56320 || u > 57343 ? t ? c.charAt(s) : i : t ? c.slice(s, s + 2) : u - 56320 + (i - 55296 << 10) + 65536
    }
  }
}, function (t, e, n) {
  t.exports = n(66)("native-function-to-string", Function.toString)
}, , function (t, e, n) {
  for (var r = n(117), o = n(183), i = n(35), u = n(17), c = n(29), s = n(118), a = n(12), f = a("iterator"), l = a("toStringTag"), p = s.Array, v = {
    CSSRuleList: !0,
    CSSStyleDeclaration: !1,
    CSSValueList: !1,
    ClientRectList: !1,
    DOMRectList: !1,
    DOMStringList: !1,
    DOMTokenList: !0,
    DataTransferItemList: !1,
    FileList: !1,
    HTMLAllCollection: !1,
    HTMLCollection: !1,
    HTMLFormElement: !1,
    HTMLSelectElement: !1,
    MediaList: !0,
    MimeTypeArray: !1,
    NamedNodeMap: !1,
    NodeList: !0,
    PaintRequestList: !1,
    Plugin: !1,
    PluginArray: !1,
    SVGLengthList: !1,
    SVGNumberList: !1,
    SVGPathSegList: !1,
    SVGPointList: !1,
    SVGStringList: !1,
    SVGTransformList: !1,
    SourceBufferList: !1,
    StyleSheetList: !0,
    TextTrackCueList: !1,
    TextTrackList: !1,
    TouchList: !1
  }, d = o(v), h = 0; h < d.length; h++) {
    var g, y = d[h],
      m = v[y],
      _ = u[y],
      x = _ && _.prototype;
    if (x && (x[f] || c(x, f, p), x[l] || c(x, l, y), s[y] = p, m))
      for (g in r) x[g] || i(x, g, r[g], !0)
  }
}, function (t, e, n) {
  var r = n(98),
    o = n(43),
    i = n(198);
  t.exports = function (t) {
    return function (e, n, u) {
      var c, s = r(e),
        a = o(s.length),
        f = i(u, a);
      if (t && n != n) {
        for (; a > f;)
          if ((c = s[f++]) != c) return !0
      } else
        for (; a > f; f++)
          if ((t || f in s) && s[f] === n) return t || f || 0;
      return !t && -1
    }
  }
}, function (t, e) {
  t.exports = "constructor,hasOwnProperty,isPrototypeOf,propertyIsEnumerable,toLocaleString,toString,valueOf".split(",")
}, function (t, e, n) {
  var r = n(107);
  t.exports = function _isNativeReflectConstruct() {
    if ("undefined" == typeof Reflect || !r) return !1;
    if (r.sham) return !1;
    if ("function" == typeof Proxy) return !0;
    try {
      return Date.prototype.toString.call(r(Date, [], (function () { }))), !0
    } catch (t) {
      return !1
    }
  }
}, function (t, e) {
  t.exports = function (t, e) {
    return {
      value: e,
      done: !!t
    }
  }
}, , function (t, e, n) {
  t.exports = n(171)
}, , function (t, e, n) {
  var r = n(45).f,
    o = n(61),
    i = n(12)("toStringTag");
  t.exports = function (t, e, n) {
    t && !o(t = n ? t : t.prototype, i) && r(t, i, {
      configurable: !0,
      value: e
    })
  }
}, function (t, e, n) {
  var r = n(18),
    o = n(91),
    i = n(12)("species");
  t.exports = function (t, e) {
    var n, u = r(t).constructor;
    return void 0 === u || null == (n = r(u)[i]) ? e : o(n)
  }
}, function (t, e, n) {
  n(156);
  var r = n(6).Object;
  t.exports = function defineProperty(t, e, n) {
    return r.defineProperty(t, e, n)
  }
}, function (t, e, n) {
  var r = n(7);
  r(r.S + r.F * !n(14), "Object", {
    defineProperty: n(15).f
  })
}, function (t, e, n) {
  t.exports = n(158)
}, function (t, e, n) {
  n(159), t.exports = n(6).Object.getPrototypeOf
}, function (t, e, n) {
  var r = n(32),
    o = n(64);
  n(83)("getPrototypeOf", (function () {
    return function getPrototypeOf(t) {
      return o(r(t))
    }
  }))
}, function (t, e, n) {
  n(161), t.exports = n(6).Object.setPrototypeOf
}, function (t, e, n) {
  var r = n(7);
  r(r.S, "Object", {
    setPrototypeOf: n(162).set
  })
}, function (t, e, n) {
  var r = n(9),
    o = n(13),
    check = function (t, e) {
      if (o(t), !r(e) && null !== e) throw TypeError(e + ": can't set as prototype!")
    };
  t.exports = {
    set: Object.setPrototypeOf || ("__proto__" in {} ? function (t, e, r) {
      try {
        (r = n(31)(Function.call, n(51).f(Object.prototype, "__proto__").set, 2))(t, []), e = !(t instanceof Array)
      } catch (t) {
        e = !0
      }
      return function setPrototypeOf(t, n) {
        return check(t, n), e ? t.__proto__ = n : r(t, n), t
      }
    }({}, !1) : void 0),
    check: check
  }
}, function (t, e, n) {
  n(164);
  var r = n(6).Object;
  t.exports = function create(t, e) {
    return r.create(t, e)
  }
}, function (t, e, n) {
  var r = n(7);
  r(r.S, "Object", {
    create: n(52)
  })
}, function (t, e, n) {
  var r = n(20),
    o = n(68),
    i = n(166);
  t.exports = function (t) {
    return function (e, n, u) {
      var c, s = r(e),
        a = o(s.length),
        f = i(u, a);
      if (t && n != n) {
        for (; a > f;)
          if ((c = s[f++]) != c) return !0
      } else
        for (; a > f; f++)
          if ((t || f in s) && s[f] === n) return t || f || 0;
      return !t && -1
    }
  }
}, function (t, e, n) {
  var r = n(77),
    o = Math.max,
    i = Math.min;
  t.exports = function (t, e) {
    return (t = r(t)) < 0 ? o(t + e, 0) : i(t, e)
  }
}, function (t, e, n) {
  n(168), t.exports = n(6).Reflect.construct
}, function (t, e, n) {
  var r = n(7),
    o = n(52),
    i = n(38),
    u = n(13),
    c = n(9),
    s = n(22),
    a = n(169),
    f = (n(8).Reflect || {}).construct,
    l = s((function () {
      function F() { }
      return !(f((function () { }), [], F) instanceof F)
    })),
    p = !s((function () {
      f((function () { }))
    }));
  r(r.S + r.F * (l || p), "Reflect", {
    construct: function construct(t, e) {
      i(t), u(e);
      var n = arguments.length < 3 ? t : i(arguments[2]);
      if (p && !l) return f(t, e, n);
      if (t == n) {
        switch (e.length) {
          case 0:
            return new t;
          case 1:
            return new t(e[0]);
          case 2:
            return new t(e[0], e[1]);
          case 3:
            return new t(e[0], e[1], e[2]);
          case 4:
            return new t(e[0], e[1], e[2], e[3])
        }
        var r = [null];
        return r.push.apply(r, e), new (a.apply(t, r))
      }
      var s = n.prototype,
        v = o(c(s) ? s : Object.prototype),
        d = Function.apply.call(t, v, e);
      return c(d) ? d : v
    }
  })
}, function (t, e, n) {
  "use strict";
  var r = n(38),
    o = n(9),
    i = n(132),
    u = [].slice,
    c = {},
    construct = function (t, e, n) {
      if (!(e in c)) {
        for (var r = [], o = 0; o < e; o++) r[o] = "a[" + o + "]";
        c[e] = Function("F,a", "return new F(" + r.join(",") + ")")
      }
      return c[e](t, n)
    };
  t.exports = Function.bind || function bind(t) {
    var e = r(this),
      n = u.call(arguments, 1),
      bound = function () {
        var r = n.concat(u.call(arguments));
        return this instanceof bound ? construct(e, r.length, r) : i(e, r, t)
      };
    return o(e.prototype) && (bound.prototype = e.prototype), bound
  }
}, function (t, e, n) {
  var r = n(48),
    o = n(49);
  t.exports = function _possibleConstructorReturn(t, e) {
    return !e || "object" !== r(e) && "function" != typeof e ? o(t) : e
  }
}, function (t, e, n) {
  n(60), n(62), t.exports = n(63).f("iterator")
}, function (t, e, n) {
  var r = n(77),
    o = n(65);
  t.exports = function (t) {
    return function (e, n) {
      var i, u, c = String(o(e)),
        s = r(n),
        a = c.length;
      return s < 0 || s >= a ? t ? "" : void 0 : (i = c.charCodeAt(s)) < 55296 || i > 56319 || s + 1 === a || (u = c.charCodeAt(s + 1)) < 56320 || u > 57343 ? t ? c.charAt(s) : i : t ? c.slice(s, s + 2) : u - 56320 + (i - 55296 << 10) + 65536
    }
  }
}, function (t, e, n) {
  "use strict";
  var r = n(52),
    o = n(44),
    i = n(53),
    u = {};
  n(24)(u, n(10)("iterator"), (function () {
    return this
  })), t.exports = function (t, e, n) {
    t.prototype = r(u, {
      next: o(1, n)
    }), i(t, e + " Iterator")
  }
}, function (t, e, n) {
  "use strict";
  var r = n(175),
    o = n(149),
    i = n(34),
    u = n(20);
  t.exports = n(108)(Array, "Array", (function (t, e) {
    this._t = u(t), this._i = 0, this._k = e
  }), (function () {
    var t = this._t,
      e = this._k,
      n = this._i++;
    return !t || n >= t.length ? (this._t = void 0, o(1)) : o(0, "keys" == e ? n : "values" == e ? t[n] : [n, t[n]])
  }), "values"), i.Arguments = i.Array, r("keys"), r("values"), r("entries")
}, function (t, e) {
  t.exports = function () { }
}, function (t, e, n) {
  n(138), n(100), n(179), n(180), t.exports = n(6).Symbol
}, function (t, e, n) {
  var r = n(40),
    o = n(71),
    i = n(50);
  t.exports = function (t) {
    var e = r(t),
      n = o.f;
    if (n)
      for (var u, c = n(t), s = i.f, a = 0; c.length > a;) s.call(t, u = c[a++]) && e.push(u);
    return e
  }
}, function (t, e, n) {
  var r = n(20),
    o = n(99).f,
    i = {}.toString,
    u = "object" == typeof window && window && Object.getOwnPropertyNames ? Object.getOwnPropertyNames(window) : [];
  t.exports.f = function getOwnPropertyNames(t) {
    return u && "[object Window]" == i.call(t) ? function (t) {
      try {
        return o(t)
      } catch (t) {
        return u.slice()
      }
    }(t) : o(r(t))
  }
}, function (t, e, n) {
  n(79)("asyncIterator")
}, function (t, e, n) {
  n(79)("observable")
}, function (t, e, n) {
  var r = n(73),
    o = n(120),
    i = n(96),
    u = n(43),
    c = n(216);
  t.exports = function (t, e) {
    var n = 1 == t,
      s = 2 == t,
      a = 3 == t,
      f = 4 == t,
      l = 6 == t,
      p = 5 == t || l,
      v = e || c;
    return function (e, c, d) {
      for (var h, g, y = i(e), m = o(y), _ = r(c, d, 3), x = u(m.length), b = 0, S = n ? v(e, x) : s ? v(e, 0) : void 0; x > b; b++)
        if ((p || b in m) && (g = _(h = m[b], b, y), t))
          if (n) S[b] = g;
          else if (g) switch (t) {
            case 3:
              return !0;
            case 5:
              return h;
            case 6:
              return b;
            case 2:
              S.push(h)
          } else if (f) return !1;
      return l ? -1 : a || f ? f : S
    }
  }
}, , function (t, e, n) {
  var r = n(219),
    o = n(147);
  t.exports = Object.keys || function keys(t) {
    return r(t, o)
  }
}, , , , , function (t, e, n) {
  "use strict";
  var r = n(37),
    o = n(213);
  r(r.P + r.F * n(214)("includes"), "String", {
    includes: function includes(t) {
      return !!~o(this, t, "includes").indexOf(t, arguments.length > 1 ? arguments[1] : void 0)
    }
  })
}, , function (t, e, n) {
  "use strict";
  var r = n(88);
  n(37)({
    target: "RegExp",
    proto: !0,
    forced: r !== /./.exec
  }, {
    exec: r
  })
}, function (t, e, n) {
  n(192);
  var r = n(6).Object;
  t.exports = function getOwnPropertyDescriptor(t, e) {
    return r.getOwnPropertyDescriptor(t, e)
  }
}, function (t, e, n) {
  var r = n(20),
    o = n(51).f;
  n(83)("getOwnPropertyDescriptor", (function () {
    return function getOwnPropertyDescriptor(t, e) {
      return o(r(t), e)
    }
  }))
}, function (t, e, n) {
  t.exports = n(194)
}, function (t, e, n) {
  n(195), t.exports = n(6).Reflect.get
}, function (t, e, n) {
  var r = n(51),
    o = n(64),
    i = n(19),
    u = n(7),
    c = n(9),
    s = n(13);
  u(u.S, "Reflect", {
    get: function get(t, e) {
      var n, u, a = arguments.length < 3 ? t : arguments[2];
      return s(t) === a ? t[e] : (n = r.f(t, e)) ? i(n, "value") ? n.value : void 0 !== n.get ? n.get.call(a) : void 0 : c(u = o(t)) ? get(u, e, a) : void 0
    }
  })
}, function (t, e, n) {
  var r = n(16);
  t.exports = function _superPropBase(t, e) {
    for (; !Object.prototype.hasOwnProperty.call(t, e) && null !== (t = r(t)););
    return t
  }
}, function (t, e, n) {
  "use strict";
  var r = n(110),
    o = n(37),
    i = n(35),
    u = n(29),
    c = n(118),
    s = n(242),
    a = n(153),
    f = n(244),
    l = n(12)("iterator"),
    p = !([].keys && "next" in [].keys()),
    returnThis = function () {
      return this
    };
  t.exports = function (t, e, n, v, d, h, g) {
    s(n, e, v);
    var y, m, _, getMethod = function (t) {
      if (!p && t in w) return w[t];
      switch (t) {
        case "keys":
          return function keys() {
            return new n(this, t)
          };
        case "values":
          return function values() {
            return new n(this, t)
          }
      }
      return function entries() {
        return new n(this, t)
      }
    },
      x = e + " Iterator",
      b = "values" == d,
      S = !1,
      w = t.prototype,
      O = w[l] || w["@@iterator"] || d && w[d],
      E = O || getMethod(d),
      I = d ? b ? getMethod("entries") : E : void 0,
      j = "Array" == e && w.entries || O;
    if (j && (_ = f(j.call(new t))) !== Object.prototype && _.next && (a(_, x, !0), r || "function" == typeof _[l] || u(_, l, returnThis)), b && O && "values" !== O.name && (S = !0, E = function values() {
      return O.call(this)
    }), r && !g || !p && !S && w[l] || u(w, l, E), c[e] = E, c[x] = returnThis, d)
      if (y = {
        values: b ? E : getMethod("values"),
        keys: h ? E : getMethod("keys"),
        entries: I
      }, g)
        for (m in y) m in w || i(w, m, y[m]);
      else o(o.P + o.F * (p || S), e, y);
    return y
  }
}, function (t, e, n) {
  var r = n(57),
    o = Math.max,
    i = Math.min;
  t.exports = function (t, e) {
    return (t = r(t)) < 0 ? o(t + e, 0) : i(t, e)
  }
}, , , function (t, e, n) {
  n(202), t.exports = n(6).Object.keys
}, function (t, e, n) {
  var r = n(32),
    o = n(40);
  n(83)("keys", (function () {
    return function keys(t) {
      return o(r(t))
    }
  }))
}, , , , , , , , , function (t, e, n) {
  t.exports = n(281)
}, , function (t, e, n) {
  var r = n(122),
    o = n(42);
  t.exports = function (t, e, n) {
    if (r(e)) throw TypeError("String#" + n + " doesn't accept regex!");
    return String(o(t))
  }
}, function (t, e, n) {
  var r = n(12)("match");
  t.exports = function (t) {
    var e = /./;
    try {
      "/./"[t](e)
    } catch (n) {
      try {
        return e[r] = !1, !"/./"[t](e)
      } catch (t) { }
    }
    return !0
  }
}, , function (t, e, n) {
  var r = n(217);
  t.exports = function (t, e) {
    return new (r(t))(e)
  }
}, function (t, e, n) {
  var r = n(30),
    o = n(218),
    i = n(12)("species");
  t.exports = function (t) {
    var e;
    return o(t) && ("function" != typeof (e = t.constructor) || e !== Array && !o(e.prototype) || (e = void 0), r(e) && null === (e = e[i]) && (e = void 0)), void 0 === e ? Array : e
  }
}, function (t, e, n) {
  var r = n(46);
  t.exports = Array.isArray || function isArray(t) {
    return "Array" == r(t)
  }
}, function (t, e, n) {
  var r = n(61),
    o = n(98),
    i = n(146)(!1),
    u = n(130)("IE_PROTO");
  t.exports = function (t, e) {
    var n, c = o(t),
      s = 0,
      a = [];
    for (n in c) n != u && r(c, n) && a.push(n);
    for (; e.length > s;) r(c, n = e[s++]) && (~i(a, n) || a.push(n));
    return a
  }
}, function (t, e, n) {
  n(221), t.exports = n(6).Array.isArray
}, function (t, e, n) {
  var r = n(7);
  r(r.S, "Array", {
    isArray: n(97)
  })
}, , function (t, e, n) {
  "use strict";
  var r = n(0);
  n(1)(e, "__esModule", {
    value: !0
  }), e.default = void 0;
  var o = r(n(48)),
    i = r(n(2)),
    u = r(n(3)),
    c = r(n(4)),
    s = r(n(5)),
    a = function (t) {
      (0, c.default)(ArgsObject, t);
      var e = (0, s.default)(ArgsObject);

      function ArgsObject(t) {
        var n;
        return (0, i.default)(this, ArgsObject), (n = e.call(this)).args = t, n
      }
      return (0, u.default)(ArgsObject, null, [{
        key: "getInstanceType",
        value: function getInstanceType() {
          return "ArgsObject"
        }
      }]), (0, u.default)(ArgsObject, [{
        key: "requireArgument",
        value: function requireArgument(t) {
          var e = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : this.args;
          if (!e.hasOwnProperty(t)) throw Error("".concat(t, " is required."))
        }
      }, {
        key: "requireArgumentType",
        value: function requireArgumentType(t, e) {
          var n = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : this.args;
          if (this.requireArgument(t, n), (0, o.default)(n[t]) !== e) throw Error("".concat(t, " invalid type: ").concat(e, "."))
        }
      }, {
        key: "requireArgumentInstance",
        value: function requireArgumentInstance(t, e) {
          var n = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : this.args;
          if (this.requireArgument(t, n), !(n[t] instanceof e)) throw Error("".concat(t, " invalid instance."))
        }
      }, {
        key: "requireArgumentConstructor",
        value: function requireArgumentConstructor(t, e) {
          var n = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : this.args;
          if (this.requireArgument(t, n), n[t].constructor !== e) throw Error("".concat(t, " invalid constructor type."))
        }
      }]), ArgsObject
    }(r(n(252)).default);
  e.default = a
}, , function (t, e, n) {
  "use strict";
  var r = n(8),
    o = n(6),
    i = n(15),
    u = n(14),
    c = n(10)("species");
  t.exports = function (t) {
    var e = "function" == typeof o[t] ? o[t] : r[t];
    u && e && !e[c] && i.f(e, c, {
      configurable: !0,
      get: function () {
        return this
      }
    })
  }
}, function (t, e, n) {
  var r = n(18),
    o = n(243),
    i = n(147),
    u = n(130)("IE_PROTO"),
    Empty = function () { },
    createDict = function () {
      var t, e = n(109)("iframe"),
        r = i.length;
      for (e.style.display = "none", n(227).appendChild(e), e.src = "javascript:", (t = e.contentWindow.document).open(), t.write("<script>document.F=Object<\/script>"), t.close(), createDict = t.F; r--;) delete createDict.prototype[i[r]];
      return createDict()
    };
  t.exports = Object.create || function create(t, e) {
    var n;
    return null !== t ? (Empty.prototype = r(t), n = new Empty, Empty.prototype = null, n[u] = t) : n = createDict(), void 0 === e ? n : o(n, e)
  }
}, function (t, e, n) {
  var r = n(17).document;
  t.exports = r && r.documentElement
}, , , , , function (t, e, n) {
  "use strict";
  var r = n(8),
    o = n(7),
    i = n(70),
    u = n(22),
    c = n(24),
    s = n(126),
    a = n(86),
    f = n(125),
    l = n(9),
    p = n(53),
    v = n(15).f,
    d = n(136)(0),
    h = n(14);
  t.exports = function (t, e, n, g, y, m) {
    var _ = r[t],
      x = _,
      b = y ? "set" : "add",
      S = x && x.prototype,
      w = {};
    return h && "function" == typeof x && (m || S.forEach && !u((function () {
      (new x).entries().next()
    }))) ? (x = e((function (e, n) {
      f(e, x, t, "_c"), e._c = new _, null != n && a(n, y, e[b], e)
    })), d("add,clear,delete,forEach,get,has,set,keys,values,entries,toJSON".split(","), (function (t) {
      var e = "add" == t || "set" == t;
      !(t in S) || m && "clear" == t || c(x.prototype, t, (function (n, r) {
        if (f(this, x, t), !e && m && !l(n)) return "get" == t && void 0;
        var o = this._c[t](0 === n ? 0 : n, r);
        return e ? this : o
      }))
    })), m || v(x.prototype, "size", {
      get: function () {
        return this._c.size
      }
    })) : (x = g.getConstructor(e, t, y, b), s(x.prototype, n), i.NEED = !0), p(x, t), w[t] = x, o(o.G + o.W + o.F, w), m || g.setStrong(x, t, y), x
  }
}, function (t, e, n) {
  "use strict";
  var r = n(7);
  t.exports = function (t) {
    r(r.S, t, {
      of: function of() {
        for (var t = arguments.length, e = new Array(t); t--;) e[t] = arguments[t];
        return new this(e)
      }
    })
  }
}, function (t, e, n) {
  "use strict";
  var r = n(7),
    o = n(38),
    i = n(31),
    u = n(86);
  t.exports = function (t) {
    r(r.S, t, {
      from: function from(t) {
        var e, n, r, c, s = arguments[1];
        return o(this), (e = void 0 !== s) && o(s), null == t ? new this : (n = [], e ? (r = 0, c = i(s, arguments[2], 2), u(t, !1, (function (t) {
          n.push(c(t, r++))
        }))) : u(t, !1, n.push, n), new this(n))
      }
    })
  }
}, function (t, e) {
  t.exports = "\t\n\v\f\r   ᠎             　\u2028\u2029\ufeff"
}, , , , , , function (t, e) {
  t.exports = function (t, e) {
    return {
      value: e,
      done: !!t
    }
  }
}, function (t, e, n) {
  "use strict";
  var r = n(226),
    o = n(102),
    i = n(153),
    u = {};
  n(29)(u, n(12)("iterator"), (function () {
    return this
  })), t.exports = function (t, e, n) {
    t.prototype = r(u, {
      next: o(1, n)
    }), i(t, e + " Iterator")
  }
}, function (t, e, n) {
  var r = n(45),
    o = n(18),
    i = n(183);
  t.exports = n(27) ? Object.defineProperties : function defineProperties(t, e) {
    o(t);
    for (var n, u = i(e), c = u.length, s = 0; c > s;) r.f(t, n = u[s++], e[n]);
    return t
  }
}, function (t, e, n) {
  var r = n(61),
    o = n(96),
    i = n(130)("IE_PROTO"),
    u = Object.prototype;
  t.exports = Object.getPrototypeOf || function (t) {
    return t = o(t), r(t, i) ? t[i] : "function" == typeof t.constructor && t instanceof t.constructor ? t.constructor.prototype : t instanceof Object ? u : null
  }
}, function (t, e, n) {
  var r = n(246);
  t.exports = function (t, e) {
    return new (r(t))(e)
  }
}, function (t, e, n) {
  var r = n(9),
    o = n(97),
    i = n(10)("species");
  t.exports = function (t) {
    var e;
    return o(t) && ("function" != typeof (e = t.constructor) || e !== Array && !o(e.prototype) || (e = void 0), r(e) && null === (e = e[i]) && (e = void 0)), void 0 === e ? Array : e
  }
}, , , , , , function (t, e, n) {
  "use strict";
  var r = n(0);
  n(1)(e, "__esModule", {
    value: !0
  }), e.default = void 0, n(39);
  var o = r(n(81)),
    i = r(n(253)),
    u = r(n(2)),
    c = r(n(3)),
    s = r(n(25)),
    a = r(n(16)),
    f = function () {
      function InstanceType() {
        var t = this;
        (0, u.default)(this, InstanceType);
        for (var e = this instanceof InstanceType ? this.constructor : void 0, n = []; e.__proto__ && e.__proto__.name;) n.push(e.__proto__), e = e.__proto__;
        n.reverse().forEach((function (e) {
          return t instanceof e
        }))
      }
      return (0, c.default)(InstanceType, null, [{
        key: i.default,
        value: function value(t) {
          var e = (0, s.default)((0, a.default)(InstanceType), i.default, this).call(this, t);
          if (t && !t.constructor.getInstanceType) return e;
          if (t && (t.instanceTypes || (t.instanceTypes = []), e || this.getInstanceType() === t.constructor.getInstanceType() && (e = !0), e)) {
            var n = this.getInstanceType === InstanceType.getInstanceType ? "BaseInstanceType" : this.getInstanceType(); - 1 === t.instanceTypes.indexOf(n) && t.instanceTypes.push(n)
          }
          return !e && t && (e = t.instanceTypes && (0, o.default)(t.instanceTypes) && -1 !== t.instanceTypes.indexOf(this.getInstanceType())), e
        }
      }]), (0, c.default)(InstanceType, null, [{
        key: "getInstanceType",
        value: function getInstanceType() {
          elementorModules.ForceMethodImplementation()
        }
      }]), InstanceType
    }();
  e.default = f
}, function (t, e, n) {
  t.exports = n(254)
}, function (t, e, n) {
  n(255), t.exports = n(63).f("hasInstance")
}, function (t, e, n) {
  "use strict";
  var r = n(9),
    o = n(64),
    i = n(10)("hasInstance"),
    u = Function.prototype;
  i in u || n(15).f(u, i, {
    value: function (t) {
      if ("function" != typeof this || !r(t)) return !1;
      if (!r(this.prototype)) return t instanceof this;
      for (; t = o(t);)
        if (this.prototype === t) return !0;
      return !1
    }
  })
}, , , , , , , , , , , , , , , , , , , , , function (t, e, n) {
  "use strict";
  var r = n(37),
    o = n(43),
    i = n(213),
    u = "".startsWith;
  r(r.P + r.F * n(214)("startsWith"), "String", {
    startsWith: function startsWith(t) {
      var e = i(this, t, "startsWith"),
        n = o(Math.min(arguments.length > 1 ? arguments[1] : void 0, e.length)),
        r = String(t);
      return u ? u.call(e, r, n) : e.slice(n, n + r.length) === r
    }
  })
}, , , , , function (t, e, n) {
  n(282), t.exports = n(6).parseInt
}, function (t, e, n) {
  var r = n(7),
    o = n(283);
  r(r.G + r.F * (parseInt != o), {
    parseInt: o
  })
}, function (t, e, n) {
  var r = n(8).parseInt,
    o = n(284).trim,
    i = n(235),
    u = /^[-+]?0[xX]/;
  t.exports = 8 !== r(i + "08") || 22 !== r(i + "0x16") ? function parseInt(t, e) {
    var n = o(String(t), 3);
    return r(n, e >>> 0 || (u.test(n) ? 16 : 10))
  } : r
}, function (t, e, n) {
  var r = n(7),
    o = n(65),
    i = n(22),
    u = n(235),
    c = "[" + u + "]",
    s = RegExp("^" + c + c + "*"),
    a = RegExp(c + c + "*$"),
    exporter = function (t, e, n) {
      var o = {},
        c = i((function () {
          return !!u[t]() || "​" != "​"[t]()
        })),
        s = o[t] = c ? e(f) : u[t];
      n && (o[n] = s), r(r.P + r.F * c, "String", o)
    },
    f = exporter.trim = function (t, e) {
      return t = String(o(t)), 1 & e && (t = t.replace(s, "")), 2 & e && (t = t.replace(a, "")), t
    };
  t.exports = exporter
}, , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , function (t, e, n) {
  var r = n(137),
    o = n(392),
    i = n(16),
    u = n(135),
    c = n(401),
    s = n(402);

  function _wrapNativeSuper(e) {
    var n = "function" == typeof o ? new o : void 0;
    return t.exports = _wrapNativeSuper = function _wrapNativeSuper(t) {
      if (null === t || !c(t)) return t;
      if ("function" != typeof t) throw new TypeError("Super expression must either be null or a function");
      if (void 0 !== n) {
        if (n.has(t)) return n.get(t);
        n.set(t, Wrapper)
      }

      function Wrapper() {
        return s(t, arguments, i(this).constructor)
      }
      return Wrapper.prototype = r(t.prototype, {
        constructor: {
          value: Wrapper,
          enumerable: !1,
          writable: !0,
          configurable: !0
        }
      }), u(Wrapper, t)
    }, _wrapNativeSuper(e)
  }
  t.exports = _wrapNativeSuper
}, , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , function (t, e, n) {
  t.exports = n(393)
}, function (t, e, n) {
  n(100), n(60), n(62), n(394), n(396), n(399), n(400), t.exports = n(6).Map
}, function (t, e, n) {
  "use strict";
  var r = n(395),
    o = n(121);
  t.exports = n(232)("Map", (function (t) {
    return function Map() {
      return t(this, arguments.length > 0 ? arguments[0] : void 0)
    }
  }), {
    get: function get(t) {
      var e = r.getEntry(o(this, "Map"), t);
      return e && e.v
    },
    set: function set(t, e) {
      return r.def(o(this, "Map"), 0 === t ? 0 : t, e)
    }
  }, r, !0)
}, function (t, e, n) {
  "use strict";
  var r = n(15).f,
    o = n(52),
    i = n(126),
    u = n(31),
    c = n(125),
    s = n(86),
    a = n(108),
    f = n(149),
    l = n(225),
    p = n(14),
    v = n(70).fastKey,
    d = n(121),
    h = p ? "_s" : "size",
    getEntry = function (t, e) {
      var n, r = v(e);
      if ("F" !== r) return t._i[r];
      for (n = t._f; n; n = n.n)
        if (n.k == e) return n
    };
  t.exports = {
    getConstructor: function (t, e, n, a) {
      var f = t((function (t, r) {
        c(t, f, e, "_i"), t._t = e, t._i = o(null), t._f = void 0, t._l = void 0, t[h] = 0, null != r && s(r, n, t[a], t)
      }));
      return i(f.prototype, {
        clear: function clear() {
          for (var t = d(this, e), n = t._i, r = t._f; r; r = r.n) r.r = !0, r.p && (r.p = r.p.n = void 0), delete n[r.i];
          t._f = t._l = void 0, t[h] = 0
        },
        delete: function (t) {
          var n = d(this, e),
            r = getEntry(n, t);
          if (r) {
            var o = r.n,
              i = r.p;
            delete n._i[r.i], r.r = !0, i && (i.n = o), o && (o.p = i), n._f == r && (n._f = o), n._l == r && (n._l = i), n[h]--
          }
          return !!r
        },
        forEach: function forEach(t) {
          d(this, e);
          for (var n, r = u(t, arguments.length > 1 ? arguments[1] : void 0, 3); n = n ? n.n : this._f;)
            for (r(n.v, n.k, this); n && n.r;) n = n.p
        },
        has: function has(t) {
          return !!getEntry(d(this, e), t)
        }
      }), p && r(f.prototype, "size", {
        get: function () {
          return d(this, e)[h]
        }
      }), f
    },
    def: function (t, e, n) {
      var r, o, i = getEntry(t, e);
      return i ? i.v = n : (t._l = i = {
        i: o = v(e, !0),
        k: e,
        v: n,
        p: r = t._l,
        n: void 0,
        r: !1
      }, t._f || (t._f = i), r && (r.n = i), t[h]++, "F" !== o && (t._i[o] = i)), t
    },
    getEntry: getEntry,
    setStrong: function (t, e, n) {
      a(t, e, (function (t, n) {
        this._t = d(t, e), this._k = n, this._l = void 0
      }), (function () {
        for (var t = this._k, e = this._l; e && e.r;) e = e.p;
        return this._t && (this._l = e = e ? e.n : this._t._f) ? f(0, "keys" == t ? e.k : "values" == t ? e.v : [e.k, e.v]) : (this._t = void 0, f(1))
      }), n ? "entries" : "values", !n, !0), l(e)
    }
  }
}, function (t, e, n) {
  var r = n(7);
  r(r.P + r.R, "Map", {
    toJSON: n(397)("Map")
  })
}, function (t, e, n) {
  var r = n(101),
    o = n(398);
  t.exports = function (t) {
    return function toJSON() {
      if (r(this) != t) throw TypeError(t + "#toJSON isn't generic");
      return o(this)
    }
  }
}, function (t, e, n) {
  var r = n(86);
  t.exports = function (t, e) {
    var n = [];
    return r(t, !1, n.push, n, e), n
  }
}, function (t, e, n) {
  n(233)("Map")
}, function (t, e, n) {
  n(234)("Map")
}, function (t, e) {
  t.exports = function _isNativeFunction(t) {
    return -1 !== Function.toString.call(t).indexOf("[native code]")
  }
}, function (t, e, n) {
  var r = n(107),
    o = n(135),
    i = n(148);

  function _construct(e, n, u) {
    return i() ? t.exports = _construct = r : t.exports = _construct = function _construct(t, e, n) {
      var r = [null];
      r.push.apply(r, e);
      var i = new (Function.bind.apply(t, r));
      return n && o(i, n.prototype), i
    }, _construct.apply(null, arguments)
  }
  t.exports = _construct
}, , , function (t, e, n) {
  "use strict";
  var r = n(0),
    o = r(n(137));
  n(39);
  var i = r(n(48));
  n(80);
  var u = function Module() {
    var t, e = jQuery,
      n = arguments,
      r = this,
      o = {},
      u = function ensureClosureMethods() {
        e.each(r, (function (t) {
          var e = r[t];
          "function" == typeof e && (r[t] = function () {
            return e.apply(r, arguments)
          })
        }))
      },
      c = function initSettings() {
        t = r.getDefaultSettings();
        var o = n[0];
        o && e.extend(!0, t, o)
      },
      s = function init() {
        r.__construct.apply(r, n), u(), c(), r.trigger("init")
      };
    this.getItems = function (t, e) {
      if (e) {
        var n = e.split("."),
          r = n.splice(0, 1);
        if (!n.length) return t[r];
        if (!t[r]) return;
        return this.getItems(t[r], n.join("."))
      }
      return t
    }, this.getSettings = function (e) {
      return this.getItems(t, e)
    }, this.setSettings = function (n, o, u) {
      if (u || (u = t), "object" === (0, i.default)(n)) return e.extend(u, n), r;
      var c = n.split("."),
        s = c.splice(0, 1);
      return c.length ? (u[s] || (u[s] = {}), r.setSettings(c.join("."), o, u[s])) : (u[s] = o, r)
    }, this.getErrorMessage = function (t, e) {
      var n;
      switch (t) {
        case "forceMethodImplementation":
          n = "The method '".concat(e, "' must to be implemented in the inheritor child.");
          break;
        default:
          n = "An error occurs"
      }
      return n
    }, this.forceMethodImplementation = function (t) {
      throw new Error(this.getErrorMessage("forceMethodImplementation", t))
    }, this.on = function (t, n) {
      return "object" === (0, i.default)(t) ? (e.each(t, (function (t) {
        r.on(t, this)
      })), r) : (t.split(" ").forEach((function (t) {
        o[t] || (o[t] = []), o[t].push(n)
      })), r)
    }, this.off = function (t, e) {
      if (!o[t]) return r;
      if (!e) return delete o[t], r;
      var n = o[t].indexOf(e);
      return -1 !== n && (delete o[t][n], o[t] = o[t].filter((function (t) {
        return t
      }))), r
    }, this.trigger = function (t) {
      var n = "on" + t[0].toUpperCase() + t.slice(1),
        i = Array.prototype.slice.call(arguments, 1);
      r[n] && r[n].apply(r, i);
      var u = o[t];
      return u ? (e.each(u, (function (t, e) {
        e.apply(r, i)
      })), r) : r
    }, s()
  };
  u.prototype.__construct = function () { }, u.prototype.getDefaultSettings = function () {
    return {}
  }, u.prototype.getConstructorID = function () {
    return this.constructor.name
  }, u.extend = function (t) {
    var e = jQuery,
      n = this,
      r = function child() {
        return n.apply(this, arguments)
      };
    return e.extend(r, n), (r.prototype = (0, o.default)(e.extend({}, n.prototype, t))).constructor = r, r.__super__ = n.prototype, r
  }, t.exports = u
}, function (t, e, n) {
  "use strict";
  var r = n(0)(n(405));
  t.exports = r.default.extend({
    elements: null,
    getDefaultElements: function getDefaultElements() {
      return {}
    },
    bindEvents: function bindEvents() { },
    onInit: function onInit() {
      this.initElements(), this.bindEvents()
    },
    initElements: function initElements() {
      this.elements = this.getDefaultElements()
    }
  })
}, , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , function (t, e, n) {
  "use strict";
  var r = n(0);
  n(1)(e, "__esModule", {
    value: !0
  }), e.default = void 0, n(26);
  var o = r(n(2)),
    i = r(n(3)),
    u = r(n(25)),
    c = r(n(16)),
    s = r(n(4)),
    a = r(n(5)),
    f = function (t) {
      (0, s.default)(_default, t);
      var e = (0, a.default)(_default);

      function _default() {
        return (0, o.default)(this, _default), e.apply(this, arguments)
      }
      return (0, i.default)(_default, [{
        key: "getDefaultSettings",
        value: function getDefaultSettings() {
          return {
            selectors: {
              elements: ".elementor-element",
              nestedDocumentElements: ".elementor .elementor-element"
            },
            classes: {
              editMode: "elementor-edit-mode"
            }
          }
        }
      }, {
        key: "getDefaultElements",
        value: function getDefaultElements() {
          var t = this.getSettings("selectors");
          return {
            $elements: this.$element.find(t.elements).not(this.$element.find(t.nestedDocumentElements))
          }
        }
      }, {
        key: "getDocumentSettings",
        value: function getDocumentSettings(t) {
          var e;
          if (this.isEdit) {
            e = {};
            var n = elementor.settings.page.model;
            jQuery.each(n.getActiveControls(), (function (t) {
              e[t] = n.attributes[t]
            }))
          } else e = this.$element.data("elementor-settings") || {};
          return this.getItems(e, t)
        }
      }, {
        key: "runElementsHandlers",
        value: function runElementsHandlers() {
          this.elements.$elements.each((function (t, e) {
            return elementorFrontend.elementsHandler.runReadyTrigger(e)
          }))
        }
      }, {
        key: "onInit",
        value: function onInit() {
          var t = this;
          this.$element = this.getSettings("$element"), (0, u.default)((0, c.default)(_default.prototype), "onInit", this).call(this), this.isEdit = this.$element.hasClass(this.getSettings("classes.editMode")), this.isEdit ? elementor.on("document:loaded", (function () {
            elementor.settings.page.model.on("change", t.onSettingsChange.bind(t))
          })) : this.runElementsHandlers()
        }
      }, {
        key: "onSettingsChange",
        value: function onSettingsChange() { }
      }]), _default
    }(elementorModules.ViewModule);
  e.default = f
}, , function (t, e, n) {
  "use strict";
  var r = n(0);
  n(1)(e, "__esModule", {
    value: !0
  }), e.default = void 0;
  var o = r(n(405)),
    i = r(n(406)),
    u = r(n(223)),
    c = r(n(660)),
    s = r(n(661)),
    a = window.elementorModules = {
      Module: o.default,
      ViewModule: i.default,
      ArgsObject: u.default,
      ForceMethodImplementation: s.default,
      utils: {
        Masonry: c.default
      }
    };
  e.default = a
}, function (t, e, n) {
  "use strict";
  var r = n(0),
    o = r(n(211)),
    i = r(n(406));
  t.exports = i.default.extend({
    getDefaultSettings: function getDefaultSettings() {
      return {
        container: null,
        items: null,
        columnsCount: 3,
        verticalSpaceBetween: 30
      }
    },
    getDefaultElements: function getDefaultElements() {
      return {
        $container: jQuery(this.getSettings("container")),
        $items: jQuery(this.getSettings("items"))
      }
    },
    run: function run() {
      var t = [],
        e = this.elements.$container.position().top,
        n = this.getSettings(),
        r = n.columnsCount;
      e += (0, o.default)(this.elements.$container.css("margin-top"), 10), this.elements.$items.each((function (i) {
        var u = Math.floor(i / r),
          c = jQuery(this),
          s = c[0].getBoundingClientRect().height + n.verticalSpaceBetween;
        if (u) {
          var a = c.position(),
            f = i % r,
            l = a.top - e - t[f];
          l -= (0, o.default)(c.css("margin-top"), 10), l *= -1, c.css("margin-top", l + "px"), t[f] += s
        } else t.push(s)
      }))
    }
  })
}, function (t, e, n) {
  "use strict";
  var r = n(0);
  n(1)(e, "__esModule", {
    value: !0
  }), e.default = e.ForceMethodImplementation = void 0, n(141), n(188), n(276), n(80);
  var o = r(n(2)),
    i = r(n(49)),
    u = r(n(4)),
    c = r(n(5)),
    s = function (t) {
      (0, u.default)(ForceMethodImplementation, t);
      var e = (0, c.default)(ForceMethodImplementation);

      function ForceMethodImplementation() {
        var t, n = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {};
        return (0, o.default)(this, ForceMethodImplementation), t = e.call(this, "".concat(n.isStatic ? "static " : "").concat(n.fullName, "() should be implemented, please provide '").concat(n.functionName || n.fullName, "' functionality.")), Error.captureStackTrace((0, i.default)(t), ForceMethodImplementation), t
      }
      return ForceMethodImplementation
    }((0, r(n(342)).default)(Error));
  e.ForceMethodImplementation = s;
  e.default = function _default() {
    var t = Error().stack.split("\n")[2].trim(),
      e = t.startsWith("at new") ? "constructor" : t.split(" ")[1],
      n = {};
    if (n.functionName = e, n.fullName = e, n.functionName.includes(".")) {
      var r = n.functionName.split(".");
      n.className = r[0], n.functionName = r[1]
    } else n.isStatic = !0;
    throw new s(n)
  }
}, , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , function (t, e, n) {
  "use strict";
  var r = n(0);
  n(145), n(117), n(72), n(80);
  var o = r(n(23));
  n(26), t.exports = elementorModules.ViewModule.extend({
    $element: null,
    editorListeners: null,
    onElementChange: null,
    onEditSettingsChange: null,
    onPageSettingsChange: null,
    isEdit: null,
    __construct: function __construct(t) {
      this.$element = t.$element, this.isEdit = this.$element.hasClass("elementor-element-edit-mode"), this.isEdit && this.addEditorListeners()
    },
    findElement: function findElement(t) {
      var e = this.$element;
      return e.find(t).filter((function () {
        return jQuery(this).closest(".elementor-element").is(e)
      }))
    },
    getUniqueHandlerID: function getUniqueHandlerID(t, e) {
      return t || (t = this.getModelCID()), e || (e = this.$element), t + e.attr("data-element_type") + this.getConstructorID()
    },
    initEditorListeners: function initEditorListeners() {
      var t = this;
      if (t.editorListeners = [{
        event: "element:destroy",
        to: elementor.channels.data,
        callback: function callback(e) {
          e.cid === t.getModelCID() && t.onDestroy()
        }
      }], t.onElementChange) {
        var e = t.getWidgetType() || t.getElementType(),
          n = "change";
        "global" !== e && (n += ":" + e), t.editorListeners.push({
          event: n,
          to: elementor.channels.editor,
          callback: function callback(e, n) {
            t.getUniqueHandlerID(n.model.cid, n.$el) === t.getUniqueHandlerID() && t.onElementChange(e.model.get("name"), e, n)
          }
        })
      }
      t.onEditSettingsChange && t.editorListeners.push({
        event: "change:editSettings",
        to: elementor.channels.editor,
        callback: function callback(e, n) {
          n.model.cid === t.getModelCID() && t.onEditSettingsChange((0, o.default)(e.changed)[0])
        }
      }), ["page"].forEach((function (e) {
        var n = "on" + e[0].toUpperCase() + e.slice(1) + "SettingsChange";
        t[n] && t.editorListeners.push({
          event: "change",
          to: elementor.settings[e].model,
          callback: function callback(e) {
            t[n](e.changed)
          }
        })
      }))
    },
    getEditorListeners: function getEditorListeners() {
      return this.editorListeners || this.initEditorListeners(), this.editorListeners
    },
    addEditorListeners: function addEditorListeners() {
      var t = this.getUniqueHandlerID();
      this.getEditorListeners().forEach((function (e) {
        elementorFrontend.addListenerOnce(t, e.event, e.callback, e.to)
      }))
    },
    removeEditorListeners: function removeEditorListeners() {
      var t = this.getUniqueHandlerID();
      this.getEditorListeners().forEach((function (e) {
        elementorFrontend.removeListeners(t, e.event, null, e.to)
      }))
    },
    getElementType: function getElementType() {
      return this.$element.data("element_type")
    },
    getWidgetType: function getWidgetType() {
      var t = this.$element.data("widget_type");
      if (t) return t.split(".")[0]
    },
    getID: function getID() {
      return this.$element.data("id")
    },
    getModelCID: function getModelCID() {
      return this.$element.data("model-cid")
    },
    getElementSettings: function getElementSettings(t) {
      var e = {},
        n = this.getModelCID();
      if (this.isEdit && n) {
        var r = elementorFrontend.config.elements.data[n],
          o = r.attributes,
          i = o.widgetType || o.elType;
        o.isInner && (i = "inner-" + i);
        var u = elementorFrontend.config.elements.keys[i];
        u || (u = elementorFrontend.config.elements.keys[i] = [], jQuery.each(r.controls, (function (t, e) {
          e.frontend_available && u.push(t)
        }))), jQuery.each(r.getActiveControls(), (function (t) {
          if (-1 !== u.indexOf(t)) {
            var n = o[t];
            n.toJSON && (n = n.toJSON()), e[t] = n
          }
        }))
      } else e = this.$element.data("settings") || {};
      return this.getItems(e, t)
    },
    getEditSettings: function getEditSettings(t) {
      var e = {};
      return this.isEdit && (e = elementorFrontend.config.elements.editSettings[this.getModelCID()].attributes), this.getItems(e, t)
    },
    getCurrentDeviceSetting: function getCurrentDeviceSetting(t) {
      return elementorFrontend.getCurrentDeviceSetting(this.getElementSettings(), t)
    },
    onDestroy: function onDestroy() {
      this.isEdit && this.removeEditorListeners(), this.unbindEvents && this.unbindEvents()
    }
  })
}, , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , function (t, e, n) {
  "use strict";
  var r = n(0),
    o = r(n(659)),
    i = r(n(657)),
    u = r(n(919)),
    c = r(n(701)),
    s = r(n(920));
  o.default.frontend = {
    Document: i.default,
    tools: {
      StretchElement: u.default
    },
    handlers: {
      Base: c.default,
      SwiperBase: s.default
    }
  }
}, function (t, e, n) {
  "use strict";
  t.exports = elementorModules.ViewModule.extend({
    getDefaultSettings: function getDefaultSettings() {
      return {
        element: null,
        direction: elementorFrontend.config.is_rtl ? "right" : "left",
        selectors: {
          container: window
        }
      }
    },
    getDefaultElements: function getDefaultElements() {
      return {
        $element: jQuery(this.getSettings("element"))
      }
    },
    stretch: function stretch() {
      var t, e = this.getSettings("selectors.container");
      try {
        t = jQuery(e)
      } catch (t) { }
      t && t.length || (t = jQuery(this.getDefaultSettings().selectors.container)), this.reset();
      var n = this.elements.$element,
        r = t.outerWidth(),
        o = n.offset().left,
        i = "fixed" === n.css("position"),
        u = i ? 0 : o;
      if (window !== t[0]) {
        var c = t.offset().left;
        i && (u = c), o > c && (u = o - c)
      }
      i || (elementorFrontend.config.is_rtl && (u = r - (n.outerWidth() + u)), u = -u);
      var s = {};
      s.width = r + "px", s[this.getSettings("direction")] = u + "px", n.css(s)
    },
    reset: function reset() {
      var t = {
        width: ""
      };
      t[this.getSettings("direction")] = "", this.elements.$element.css(t)
    }
  })
}, function (t, e, n) {
  "use strict";
  var r = n(0);
  n(1)(e, "__esModule", {
    value: !0
  }), e.default = void 0;
  var o = r(n(2)),
    i = r(n(3)),
    u = r(n(4)),
    c = r(n(5)),
    s = function (t) {
      (0, u.default)(SwiperHandlerBase, t);
      var e = (0, c.default)(SwiperHandlerBase);

      function SwiperHandlerBase() {
        return (0, o.default)(this, SwiperHandlerBase), e.apply(this, arguments)
      }
      return (0, i.default)(SwiperHandlerBase, [{
        key: "getInitialSlide",
        value: function getInitialSlide() {
          var t = this.getEditSettings();
          return t.activeItemIndex ? t.activeItemIndex - 1 : 0
        }
      }, {
        key: "getSlidesCount",
        value: function getSlidesCount() {
          return this.elements.$slides.length
        }
      }, {
        key: "hasThumbs",
        value: function hasThumbs() {
          return !1
        }
      }, {
        key: "togglePauseOnHover",
        value: function togglePauseOnHover(t) {
          var e = this.swiper,
            n = this.elements.$swiperContainer;
          this.hasThumbs() && (e = this.swipers.main, n = this.elements.$mainSwiper), t ? n.on({
            mouseenter: function mouseenter() {
              e.autoplay.stop()
            },
            mouseleave: function mouseleave() {
              e.autoplay.start()
            }
          }) : n.off("mouseenter mouseleave")
        }
      }, {
        key: "handleKenBurns",
        value: function handleKenBurns() {
          var t = this.getSettings();
          this.$activeImageBg && this.$activeImageBg.removeClass(t.classes.kenBurnsActive), this.activeItemIndex = this.swiper ? this.swiper.activeIndex : this.getInitialSlide(), this.swiper ? this.$activeImageBg = jQuery(this.swiper.slides[this.activeItemIndex]).children("." + t.classes.slideBackground) : this.$activeImageBg = jQuery(this.elements.$slides[0]).children("." + t.classes.slideBackground), this.$activeImageBg.addClass(t.classes.kenBurnsActive)
        }
      }]), SwiperHandlerBase
    }(r(n(701)).default);
  e.default = s
}]);
/*!
 * jQuery UI Position 1.11.4
 * http://jqueryui.com
 *
 * Copyright jQuery Foundation and other contributors
 * Released under the MIT license.
 * http://jquery.org/license
 *
 * http://api.jqueryui.com/position/
 */
! function (t) {
  "function" == typeof define && define.amd ? define(["jquery"], t) : t(jQuery)
}(function (I) {
  return function () {
    I.ui = I.ui || {};
    var n, H, x = Math.max,
      T = Math.abs,
      L = Math.round,
      o = /left|center|right/,
      l = /top|center|bottom/,
      f = /[\+\-]\d+(\.[\d]+)?%?/,
      s = /^\w+/,
      h = /%$/,
      i = I.fn.position;

    function P(t, i, e) {
      return [parseFloat(t[0]) * (h.test(t[0]) ? i / 100 : 1), parseFloat(t[1]) * (h.test(t[1]) ? e / 100 : 1)]
    }

    function D(t, i) {
      return parseInt(I.css(t, i), 10) || 0
    }
    I.position = {
      scrollbarWidth: function () {
        if (void 0 !== n) return n;
        var t, i, e = I("<div style='display:block;position:absolute;width:50px;height:50px;overflow:hidden;'><div style='height:100px;width:auto;'></div></div>"),
          o = e.children()[0];
        return I("body").append(e), t = o.offsetWidth, e.css("overflow", "scroll"), t === (i = o.offsetWidth) && (i = e[0].clientWidth), e.remove(), n = t - i
      },
      getScrollInfo: function (t) {
        var i = t.isWindow || t.isDocument ? "" : t.element.css("overflow-x"),
          e = t.isWindow || t.isDocument ? "" : t.element.css("overflow-y"),
          o = "scroll" === i || "auto" === i && t.width < t.element[0].scrollWidth;
        return {
          width: "scroll" === e || "auto" === e && t.height < t.element[0].scrollHeight ? I.position.scrollbarWidth() : 0,
          height: o ? I.position.scrollbarWidth() : 0
        }
      },
      getWithinInfo: function (t) {
        var i = I(t || window),
          e = I.isWindow(i[0]),
          o = !!i[0] && 9 === i[0].nodeType;
        return {
          element: i,
          isWindow: e,
          isDocument: o,
          offset: i.offset() || {
            left: 0,
            top: 0
          },
          scrollLeft: i.scrollLeft(),
          scrollTop: i.scrollTop(),
          width: e || o ? i.width() : i.outerWidth(),
          height: e || o ? i.height() : i.outerHeight()
        }
      }
    }, I.fn.position = function (c) {
      if (!c || !c.of) return i.apply(this, arguments);
      c = I.extend({}, c);
      var d, a, g, u, m, t, w = I(c.of),
        W = I.position.getWithinInfo(c.within),
        v = I.position.getScrollInfo(W),
        y = (c.collision || "flip").split(" "),
        b = {};
      return t = function (t) {
        var i = t[0];
        return 9 === i.nodeType ? {
          width: t.width(),
          height: t.height(),
          offset: {
            top: 0,
            left: 0
          }
        } : I.isWindow(i) ? {
          width: t.width(),
          height: t.height(),
          offset: {
            top: t.scrollTop(),
            left: t.scrollLeft()
          }
        } : i.preventDefault ? {
          width: 0,
          height: 0,
          offset: {
            top: i.pageY,
            left: i.pageX
          }
        } : {
                width: t.outerWidth(),
                height: t.outerHeight(),
                offset: t.offset()
              }
      }(w), w[0].preventDefault && (c.at = "left top"), a = t.width, g = t.height, u = t.offset, m = I.extend({}, u), I.each(["my", "at"], function () {
        var t, i, e = (c[this] || "").split(" ");
        1 === e.length && (e = o.test(e[0]) ? e.concat(["center"]) : l.test(e[0]) ? ["center"].concat(e) : ["center", "center"]), e[0] = o.test(e[0]) ? e[0] : "center", e[1] = l.test(e[1]) ? e[1] : "center", t = f.exec(e[0]), i = f.exec(e[1]), b[this] = [t ? t[0] : 0, i ? i[0] : 0], c[this] = [s.exec(e[0])[0], s.exec(e[1])[0]]
      }), 1 === y.length && (y[1] = y[0]), "right" === c.at[0] ? m.left += a : "center" === c.at[0] && (m.left += a / 2), "bottom" === c.at[1] ? m.top += g : "center" === c.at[1] && (m.top += g / 2), d = P(b.at, a, g), m.left += d[0], m.top += d[1], this.each(function () {
        var e, t, f = I(this),
          s = f.outerWidth(),
          h = f.outerHeight(),
          i = D(this, "marginLeft"),
          o = D(this, "marginTop"),
          n = s + i + D(this, "marginRight") + v.width,
          l = h + o + D(this, "marginBottom") + v.height,
          r = I.extend({}, m),
          p = P(b.my, f.outerWidth(), f.outerHeight());
        "right" === c.my[0] ? r.left -= s : "center" === c.my[0] && (r.left -= s / 2), "bottom" === c.my[1] ? r.top -= h : "center" === c.my[1] && (r.top -= h / 2), r.left += p[0], r.top += p[1], H || (r.left = L(r.left), r.top = L(r.top)), e = {
          marginLeft: i,
          marginTop: o
        }, I.each(["left", "top"], function (t, i) {
          I.ui.position[y[t]] && I.ui.position[y[t]][i](r, {
            targetWidth: a,
            targetHeight: g,
            elemWidth: s,
            elemHeight: h,
            collisionPosition: e,
            collisionWidth: n,
            collisionHeight: l,
            offset: [d[0] + p[0], d[1] + p[1]],
            my: c.my,
            at: c.at,
            within: W,
            elem: f
          })
        }), c.using && (t = function (t) {
          var i = u.left - r.left,
            e = i + a - s,
            o = u.top - r.top,
            n = o + g - h,
            l = {
              target: {
                element: w,
                left: u.left,
                top: u.top,
                width: a,
                height: g
              },
              element: {
                element: f,
                left: r.left,
                top: r.top,
                width: s,
                height: h
              },
              horizontal: e < 0 ? "left" : 0 < i ? "right" : "center",
              vertical: n < 0 ? "top" : 0 < o ? "bottom" : "middle"
            };
          a < s && T(i + e) < a && (l.horizontal = "center"), g < h && T(o + n) < g && (l.vertical = "middle"), x(T(i), T(e)) > x(T(o), T(n)) ? l.important = "horizontal" : l.important = "vertical", c.using.call(this, t, l)
        }), f.offset(I.extend(r, {
          using: t
        }))
      })
    }, I.ui.position = {
      fit: {
        left: function (t, i) {
          var e, o = i.within,
            n = o.isWindow ? o.scrollLeft : o.offset.left,
            l = o.width,
            f = t.left - i.collisionPosition.marginLeft,
            s = n - f,
            h = f + i.collisionWidth - l - n;
          i.collisionWidth > l ? 0 < s && h <= 0 ? (e = t.left + s + i.collisionWidth - l - n, t.left += s - e) : t.left = 0 < h && s <= 0 ? n : h < s ? n + l - i.collisionWidth : n : 0 < s ? t.left += s : 0 < h ? t.left -= h : t.left = x(t.left - f, t.left)
        },
        top: function (t, i) {
          var e, o = i.within,
            n = o.isWindow ? o.scrollTop : o.offset.top,
            l = i.within.height,
            f = t.top - i.collisionPosition.marginTop,
            s = n - f,
            h = f + i.collisionHeight - l - n;
          i.collisionHeight > l ? 0 < s && h <= 0 ? (e = t.top + s + i.collisionHeight - l - n, t.top += s - e) : t.top = 0 < h && s <= 0 ? n : h < s ? n + l - i.collisionHeight : n : 0 < s ? t.top += s : 0 < h ? t.top -= h : t.top = x(t.top - f, t.top)
        }
      },
      flip: {
        left: function (t, i) {
          var e, o, n = i.within,
            l = n.offset.left + n.scrollLeft,
            f = n.width,
            s = n.isWindow ? n.scrollLeft : n.offset.left,
            h = t.left - i.collisionPosition.marginLeft,
            r = h - s,
            p = h + i.collisionWidth - f - s,
            c = "left" === i.my[0] ? -i.elemWidth : "right" === i.my[0] ? i.elemWidth : 0,
            d = "left" === i.at[0] ? i.targetWidth : "right" === i.at[0] ? -i.targetWidth : 0,
            a = -2 * i.offset[0];
          r < 0 ? ((e = t.left + c + d + a + i.collisionWidth - f - l) < 0 || e < T(r)) && (t.left += c + d + a) : 0 < p && (0 < (o = t.left - i.collisionPosition.marginLeft + c + d + a - s) || T(o) < p) && (t.left += c + d + a)
        },
        top: function (t, i) {
          var e, o, n = i.within,
            l = n.offset.top + n.scrollTop,
            f = n.height,
            s = n.isWindow ? n.scrollTop : n.offset.top,
            h = t.top - i.collisionPosition.marginTop,
            r = h - s,
            p = h + i.collisionHeight - f - s,
            c = "top" === i.my[1] ? -i.elemHeight : "bottom" === i.my[1] ? i.elemHeight : 0,
            d = "top" === i.at[1] ? i.targetHeight : "bottom" === i.at[1] ? -i.targetHeight : 0,
            a = -2 * i.offset[1];
          r < 0 ? ((o = t.top + c + d + a + i.collisionHeight - f - l) < 0 || o < T(r)) && (t.top += c + d + a) : 0 < p && (0 < (e = t.top - i.collisionPosition.marginTop + c + d + a - s) || T(e) < p) && (t.top += c + d + a)
        }
      },
      flipfit: {
        left: function () {
          I.ui.position.flip.left.apply(this, arguments), I.ui.position.fit.left.apply(this, arguments)
        },
        top: function () {
          I.ui.position.flip.top.apply(this, arguments), I.ui.position.fit.top.apply(this, arguments)
        }
      }
    },
      function () {
        var t, i, e, o, n, l = document.getElementsByTagName("body")[0],
          f = document.createElement("div");
        for (n in t = document.createElement(l ? "div" : "body"), e = {
          visibility: "hidden",
          width: 0,
          height: 0,
          border: 0,
          margin: 0,
          background: "none"
        }, l && I.extend(e, {
          position: "absolute",
          left: "-1000px",
          top: "-1000px"
        }), e) t.style[n] = e[n];
        t.appendChild(f), (i = l || document.documentElement).insertBefore(t, i.firstChild), f.style.cssText = "position: absolute; left: 10.7432222px;", o = I(f).offset().left, H = 10 < o && o < 11, t.innerHTML = "", i.removeChild(t)
      }()
  }(), I.ui.position
});
/*! dialogs-manager v4.8.1 | (c) Kobi Zaltzberg | https://github.com/kobizz/dialogs-manager/blob/master/LICENSE.txt 
 2020-08-17 18:55 */
! function (a, b) {
  "use strict";
  var c = {
    widgetsTypes: {},
    createWidgetType: function (b, d, e) {
      e || (e = this.Widget);
      var f = function () {
        e.apply(this, arguments)
      },
        g = f.prototype = new e(b);
      return g.types = g.types.concat([b]), a.extend(g, d), g.constructor = f, f.extend = function (a, b) {
        return c.createWidgetType(a, b, f)
      }, f
    },
    addWidgetType: function (a, b, c) {
      return b && b.prototype instanceof this.Widget ? this.widgetsTypes[a] = b : this.widgetsTypes[a] = this.createWidgetType(a, b, c)
    },
    getWidgetType: function (a) {
      return this.widgetsTypes[a]
    }
  };
  c.Instance = function () {
    var b = this,
      d = {},
      e = {},
      f = function () {
        d.body = a("body")
      },
      g = function (b) {
        var c = {
          classPrefix: "dialog",
          effects: {
            show: "fadeIn",
            hide: "fadeOut"
          }
        };
        a.extend(e, c, b)
      };
    this.createWidget = function (a, d) {
      var e = c.getWidgetType(a),
        f = new e(a);
      return d = d || {}, f.init(b, d), f
    }, this.getSettings = function (a) {
      return a ? e[a] : Object.create(e)
    }, this.init = function (a) {
      return g(a), f(), b
    }, b.init()
  }, c.Widget = function (b) {
    var d = this,
      e = {},
      f = {},
      g = {},
      h = 0,
      i = ["refreshPosition"],
      j = function () {
        var a = [g.window];
        g.iframe && a.push(jQuery(g.iframe[0].contentWindow)), a.forEach(function (a) {
          e.hide.onEscKeyPress && a.on("keyup", v), e.hide.onOutsideClick && a[0].addEventListener("click", p, !0), e.hide.onOutsideContextMenu && a[0].addEventListener("contextmenu", p, !0), e.position.autoRefresh && a.on("resize", d.refreshPosition)
        }), (e.hide.onClick || e.hide.onBackgroundClick) && g.widget.on("click", n)
      },
      k = function (b, c) {
        var d = e.effects[b],
          f = g.widget;
        if (a.isFunction(d)) d.apply(f, c);
        else {
          if (!f[d]) throw "Reference Error: The effect " + d + " not found";
          f[d].apply(f, c)
        }
      },
      l = function () {
        var b = i.concat(d.getClosureMethods());
        a.each(b, function () {
          var a = this,
            b = d[a];
          d[a] = function () {
            b.apply(d, arguments)
          }
        })
      },
      m = function (a) {
        if (a.my) {
          var b = /left|right/,
            c = /([+-]\d+)?$/,
            d = g.iframe.offset(),
            e = g.iframe[0].contentWindow,
            f = a.my.split(" "),
            h = [];
          1 === f.length && (b.test(f[0]) ? f.push("center") : f.unshift("center")), f.forEach(function (a, b) {
            var f = a.replace(c, function (a) {
              return a = +a || 0, a += b ? d.top - e.scrollY : d.left - e.scrollX, a >= 0 && (a = "+" + a), a
            });
            h.push(f)
          }), a.my = h.join(" ")
        }
      },
      n = function (b) {
        if (!t(b)) {
          if (e.hide.onClick) {
            if (a(b.target).closest(e.selectors.preventClose).length) return
          } else if (b.target !== this) return;
          d.hide()
        }
      },
      o = function (b) {
        return !!e.hide.ignore && !!a(b.target).closest(e.hide.ignore).length
      },
      p = function (b) {
        t(b) || a(b.target).closest(g.widget).length || o(b) || d.hide()
      },
      q = function () {
        if (d.addElement("widget"), d.addElement("header"), d.addElement("message"), d.addElement("window", window), d.addElement("body", document.body), d.addElement("container", e.container), e.iframe && d.addElement("iframe", e.iframe), e.closeButton) {
          e.closeButtonClass && (e.closeButtonOptions.iconClass = e.closeButtonClass);
          const b = a("<div>", e.closeButtonOptions.attributes),
            c = a("<i>", {
              "class": e.closeButtonOptions.iconClass
            });
          b.append(c), d.addElement("closeButton", b)
        }
        var f = d.getSettings("id");
        f && d.setID(f);
        var h = [];
        a.each(d.types, function () {
          h.push(e.classes.globalPrefix + "-type-" + this)
        }), h.push(d.getSettings("className")), g.widget.addClass(h.join(" "))
      },
      r = function (c, f) {
        var g = a.extend(!0, {}, c.getSettings());
        e = {
          headerMessage: "",
          message: "",
          effects: g.effects,
          classes: {
            globalPrefix: g.classPrefix,
            prefix: g.classPrefix + "-" + b,
            preventScroll: g.classPrefix + "-prevent-scroll"
          },
          selectors: {
            preventClose: "." + g.classPrefix + "-prevent-close"
          },
          container: "body",
          preventScroll: !1,
          iframe: null,
          closeButton: !1,
          closeButtonOptions: {
            iconClass: g.classPrefix + "-close-button-icon",
            attributes: {}
          },
          position: {
            element: "widget",
            my: "center",
            at: "center",
            enable: !0,
            autoRefresh: !1
          },
          hide: {
            auto: !1,
            autoDelay: 5e3,
            onClick: !1,
            onOutsideClick: !0,
            onOutsideContextMenu: !1,
            onBackgroundClick: !0,
            onEscKeyPress: !0,
            ignore: ""
          }
        }, a.extend(!0, e, d.getDefaultSettings(), f), s()
      },
      s = function () {
        a.each(e, function (a) {
          var b = a.match(/^on([A-Z].*)/);
          b && (b = b[1].charAt(0).toLowerCase() + b[1].slice(1), d.on(b, this))
        })
      },
      t = function (a) {
        return "click" === a.type && 2 === a.button
      },
      u = function (a) {
        return a.replace(/([a-z])([A-Z])/g, function () {
          return arguments[1] + "-" + arguments[2].toLowerCase()
        })
      },
      v = function (a) {
        var b = 27,
          c = a.which;
        b === c && d.hide()
      },
      w = function () {
        var a = [g.window];
        g.iframe && a.push(jQuery(g.iframe[0].contentWindow)), a.forEach(function (a) {
          e.hide.onEscKeyPress && a.off("keyup", v), e.hide.onOutsideClick && a[0].removeEventListener("click", p, !0), e.hide.onOutsideContextMenu && a[0].removeEventListener("contextmenu", p, !0), e.position.autoRefresh && a.off("resize", d.refreshPosition)
        }), (e.hide.onClick || e.hide.onBackgroundClick) && g.widget.off("click", n)
      };
    this.addElement = function (b, c, d) {
      var f = g[b] = a(c || "<div>"),
        h = u(b);
      return d = d ? d + " " : "", d += e.classes.globalPrefix + "-" + h, d += " " + e.classes.prefix + "-" + h, f.addClass(d), f
    }, this.destroy = function () {
      return w(), g.widget.remove(), d.trigger("destroy"), d
    }, this.getElements = function (a) {
      return a ? g[a] : g
    }, this.getSettings = function (a) {
      var b = Object.create(e);
      return a ? b[a] : b
    }, this.hide = function () {
      if (d.isVisible()) return clearTimeout(h), k("hide", arguments), w(), e.preventScroll && d.getElements("body").removeClass(e.classes.preventScroll), d.trigger("hide"), d
    }, this.init = function (a, b) {
      if (!(a instanceof c.Instance)) throw "The " + d.widgetName + " must to be initialized from an instance of DialogsManager.Instance";
      return l(), d.trigger("init", b), r(a, b), q(), d.buildWidget(), d.attachEvents(), d.trigger("ready"), d
    }, this.isVisible = function () {
      return g.widget.is(":visible")
    }, this.on = function (b, c) {
      if ("object" == typeof b) return a.each(b, function (a) {
        d.on(a, this)
      }), d;
      var e = b.split(" ");
      return e.forEach(function (a) {
        f[a] || (f[a] = []), f[a].push(c)
      }), d
    }, this.off = function (a, b) {
      if (!f[a]) return d;
      if (!b) return delete f[a], d;
      var c = f[a].indexOf(b);
      return -1 !== c && f[a].splice(c, 1), d
    }, this.refreshPosition = function () {
      if (e.position.enable) {
        var b = a.extend({}, e.position);
        g[b.of] && (b.of = g[b.of]), b.of || (b.of = window), e.iframe && m(b), g[b.element].position(b)
      }
    }, this.setID = function (a) {
      return g.widget.attr("id", a), d
    }, this.setHeaderMessage = function (a) {
      return d.getElements("header").html(a), d
    }, this.setMessage = function (a) {
      return g.message.html(a), d
    }, this.setSettings = function (b, c) {
      return jQuery.isPlainObject(c) ? a.extend(!0, e[b], c) : e[b] = c, d
    }, this.show = function () {
      return clearTimeout(h), g.widget.appendTo(g.container).hide(), k("show", arguments), d.refreshPosition(), e.hide.auto && (h = setTimeout(d.hide, e.hide.autoDelay)), j(), e.preventScroll && d.getElements("body").addClass(e.classes.preventScroll), d.trigger("show"), d
    }, this.trigger = function (b, c) {
      var e = "on" + b[0].toUpperCase() + b.slice(1);
      d[e] && d[e](c);
      var g = f[b];
      if (g) return a.each(g, function (a, b) {
        b.call(d, c)
      }), d
    }
  }, c.Widget.prototype.types = [], c.Widget.prototype.buildWidget = function () {
    var a = this.getElements(),
      b = this.getSettings();
    a.widget.append(a.header, a.message), this.setHeaderMessage(b.headerMessage), this.setMessage(b.message), this.getSettings("closeButton") && a.widget.prepend(a.closeButton)
  }, c.Widget.prototype.attachEvents = function () {
    var a = this;
    a.getSettings("closeButton") && a.getElements("closeButton").on("click", function () {
      a.hide()
    })
  }, c.Widget.prototype.getDefaultSettings = function () {
    return {}
  }, c.Widget.prototype.getClosureMethods = function () {
    return []
  }, c.Widget.prototype.onHide = function () { }, c.Widget.prototype.onShow = function () { }, c.Widget.prototype.onInit = function () { }, c.Widget.prototype.onReady = function () { }, c.widgetsTypes.simple = c.Widget, c.addWidgetType("buttons", {
    activeKeyUp: function (a) {
      var b = 9;
      a.which === b && a.preventDefault(), this.hotKeys[a.which] && this.hotKeys[a.which](this)
    },
    activeKeyDown: function (a) {
      if (this.focusedButton) {
        var b = 9;
        if (a.which === b) {
          a.preventDefault();
          var c, d = this.focusedButton.index();
          a.shiftKey ? (c = d - 1, c < 0 && (c = this.buttons.length - 1)) : (c = d + 1, c >= this.buttons.length && (c = 0)), this.focusedButton = this.buttons[c].focus()
        }
      }
    },
    addButton: function (b) {
      var c = this,
        d = c.getSettings(),
        e = jQuery.extend(d.button, b),
        f = b.classes ? b.classes + " " : "";
      f += d.classes.globalPrefix + "-button";
      var g = c.addElement(b.name, a("<" + e.tag + ">").html(b.text), f);
      c.buttons.push(g);
      var h = function () {
        d.hide.onButtonClick && c.hide(), a.isFunction(b.callback) && b.callback.call(this, c)
      };
      return g.on("click", h), b.hotKey && (this.hotKeys[b.hotKey] = h), this.getElements("buttonsWrapper").append(g), b.focus && (this.focusedButton = g), c
    },
    bindHotKeys: function () {
      this.getElements("window").on({
        keyup: this.activeKeyUp,
        keydown: this.activeKeyDown
      })
    },
    buildWidget: function () {
      c.Widget.prototype.buildWidget.apply(this, arguments);
      var a = this.addElement("buttonsWrapper");
      this.getElements("widget").append(a)
    },
    getClosureMethods: function () {
      return ["activeKeyUp", "activeKeyDown"]
    },
    getDefaultSettings: function () {
      return {
        hide: {
          onButtonClick: !0
        },
        button: {
          tag: "button"
        }
      }
    },
    onHide: function () {
      this.unbindHotKeys()
    },
    onInit: function () {
      this.buttons = [], this.hotKeys = {}, this.focusedButton = null
    },
    onShow: function () {
      this.bindHotKeys(), this.focusedButton || (this.focusedButton = this.buttons[0]), this.focusedButton && this.focusedButton.focus()
    },
    unbindHotKeys: function () {
      this.getElements("window").off({
        keyup: this.activeKeyUp,
        keydown: this.activeKeyDown
      })
    }
  }), c.addWidgetType("lightbox", c.getWidgetType("buttons").extend("lightbox", {
    getDefaultSettings: function () {
      var b = c.getWidgetType("buttons").prototype.getDefaultSettings.apply(this, arguments);
      return a.extend(!0, b, {
        contentWidth: "auto",
        contentHeight: "auto",
        position: {
          element: "widgetContent",
          of: "widget",
          autoRefresh: !0
        }
      })
    },
    buildWidget: function () {
      c.getWidgetType("buttons").prototype.buildWidget.apply(this, arguments);
      var a = this.addElement("widgetContent"),
        b = this.getElements();
      a.append(b.header, b.message, b.buttonsWrapper), b.widget.html(a), b.closeButton && a.prepend(b.closeButton)
    },
    onReady: function () {
      var a = this.getElements(),
        b = this.getSettings();
      "auto" !== b.contentWidth && a.message.width(b.contentWidth), "auto" !== b.contentHeight && a.message.height(b.contentHeight)
    }
  })), c.addWidgetType("confirm", c.getWidgetType("lightbox").extend("confirm", {
    onReady: function () {
      c.getWidgetType("lightbox").prototype.onReady.apply(this, arguments);
      var a = this.getSettings("strings"),
        b = "cancel" === this.getSettings("defaultOption");
      this.addButton({
        name: "cancel",
        text: a.cancel,
        callback: function (a) {
          a.trigger("cancel")
        },
        focus: b
      }), this.addButton({
        name: "ok",
        text: a.confirm,
        callback: function (a) {
          a.trigger("confirm")
        },
        focus: !b
      })
    },
    getDefaultSettings: function () {
      var a = c.getWidgetType("lightbox").prototype.getDefaultSettings.apply(this, arguments);
      return a.strings = {
        confirm: "OK",
        cancel: "Cancel"
      }, a.defaultOption = "cancel", a
    }
  })), c.addWidgetType("alert", c.getWidgetType("lightbox").extend("alert", {
    onReady: function () {
      c.getWidgetType("lightbox").prototype.onReady.apply(this, arguments);
      var a = this.getSettings("strings");
      this.addButton({
        name: "ok",
        text: a.confirm,
        callback: function (a) {
          a.trigger("confirm")
        }
      })
    },
    getDefaultSettings: function () {
      var a = c.getWidgetType("lightbox").prototype.getDefaultSettings.apply(this, arguments);
      return a.strings = {
        confirm: "OK"
      }, a
    }
  })), b.DialogsManager = c
}("undefined" != typeof jQuery ? jQuery : "function" == typeof require && require("jquery"), "undefined" != typeof module ? module.exports : window);
! function () {
  "use strict";

  function Waypoint(options) {
    if (!options) throw new Error("No options passed to Waypoint constructor");
    if (!options.element) throw new Error("No element option passed to Waypoint constructor");
    if (!options.handler) throw new Error("No handler option passed to Waypoint constructor");
    this.key = "waypoint-" + keyCounter, this.options = Waypoint.Adapter.extend({}, Waypoint.defaults, options), this.element = this.options.element, this.adapter = new Waypoint.Adapter(this.element), this.callback = options.handler, this.axis = this.options.horizontal ? "horizontal" : "vertical", this.enabled = this.options.enabled, this.triggerPoint = null, this.group = Waypoint.Group.findOrCreate({
      name: this.options.group,
      axis: this.axis
    }), this.context = Waypoint.Context.findOrCreateByElement(this.options.context), Waypoint.offsetAliases[this.options.offset] && (this.options.offset = Waypoint.offsetAliases[this.options.offset]), this.group.add(this), this.context.add(this), allWaypoints[this.key] = this, keyCounter += 1
  }
  var keyCounter = 0,
    allWaypoints = {};
  Waypoint.prototype.queueTrigger = function (direction) {
    this.group.queueTrigger(this, direction)
  }, Waypoint.prototype.trigger = function (args) {
    this.enabled && this.callback && this.callback.apply(this, args)
  }, Waypoint.prototype.destroy = function () {
    this.context.remove(this), this.group.remove(this), delete allWaypoints[this.key]
  }, Waypoint.prototype.disable = function () {
    return this.enabled = !1, this
  }, Waypoint.prototype.enable = function () {
    return this.context.refresh(), this.enabled = !0, this
  }, Waypoint.prototype.next = function () {
    return this.group.next(this)
  }, Waypoint.prototype.previous = function () {
    return this.group.previous(this)
  }, Waypoint.invokeAll = function (method) {
    var allWaypointsArray = [];
    for (var waypointKey in allWaypoints) allWaypointsArray.push(allWaypoints[waypointKey]);
    for (var i = 0, end = allWaypointsArray.length; i < end; i++) allWaypointsArray[i][method]()
  }, Waypoint.destroyAll = function () {
    Waypoint.invokeAll("destroy")
  }, Waypoint.disableAll = function () {
    Waypoint.invokeAll("disable")
  }, Waypoint.enableAll = function () {
    Waypoint.Context.refreshAll();
    for (var waypointKey in allWaypoints) allWaypoints[waypointKey].enabled = !0;
    return this
  }, Waypoint.refreshAll = function () {
    Waypoint.Context.refreshAll()
  }, Waypoint.viewportHeight = function () {
    return window.innerHeight || document.documentElement.clientHeight
  }, Waypoint.viewportWidth = function () {
    return document.documentElement.clientWidth
  }, Waypoint.adapters = [], Waypoint.defaults = {
    context: window,
    continuous: !0,
    enabled: !0,
    group: "default",
    horizontal: !1,
    offset: 0
  }, Waypoint.offsetAliases = {
    "bottom-in-view": function () {
      return this.context.innerHeight() - this.adapter.outerHeight()
    },
    "right-in-view": function () {
      return this.context.innerWidth() - this.adapter.outerWidth()
    }
  }, window.Waypoint = Waypoint
}(),
  function () {
    "use strict";

    function requestAnimationFrameShim(callback) {
      window.setTimeout(callback, 1e3 / 60)
    }

    function Context(element) {
      this.element = element, this.Adapter = Waypoint.Adapter, this.adapter = new this.Adapter(element), this.key = "waypoint-context-" + keyCounter, this.didScroll = !1, this.didResize = !1, this.oldScroll = {
        x: this.adapter.scrollLeft(),
        y: this.adapter.scrollTop()
      }, this.waypoints = {
        vertical: {},
        horizontal: {}
      }, element.waypointContextKey = this.key, contexts[element.waypointContextKey] = this, keyCounter += 1, Waypoint.windowContext || (Waypoint.windowContext = !0, Waypoint.windowContext = new Context(window)), this.createThrottledScrollHandler(), this.createThrottledResizeHandler()
    }
    var keyCounter = 0,
      contexts = {},
      Waypoint = window.Waypoint,
      oldWindowLoad = window.onload;
    Context.prototype.add = function (waypoint) {
      var axis = waypoint.options.horizontal ? "horizontal" : "vertical";
      this.waypoints[axis][waypoint.key] = waypoint, this.refresh()
    }, Context.prototype.checkEmpty = function () {
      var horizontalEmpty = this.Adapter.isEmptyObject(this.waypoints.horizontal),
        verticalEmpty = this.Adapter.isEmptyObject(this.waypoints.vertical),
        isWindow = this.element == this.element.window;
      horizontalEmpty && verticalEmpty && !isWindow && (this.adapter.off(".waypoints"), delete contexts[this.key])
    }, Context.prototype.createThrottledResizeHandler = function () {
      function resizeHandler() {
        self.handleResize(), self.didResize = !1
      }
      var self = this;
      this.adapter.on("resize.waypoints", function () {
        self.didResize || (self.didResize = !0, Waypoint.requestAnimationFrame(resizeHandler))
      })
    }, Context.prototype.createThrottledScrollHandler = function () {
      function scrollHandler() {
        self.handleScroll(), self.didScroll = !1
      }
      var self = this;
      this.adapter.on("scroll.waypoints", function () {
        self.didScroll && !Waypoint.isTouch || (self.didScroll = !0, Waypoint.requestAnimationFrame(scrollHandler))
      })
    }, Context.prototype.handleResize = function () {
      Waypoint.Context.refreshAll()
    }, Context.prototype.handleScroll = function () {
      var triggeredGroups = {},
        axes = {
          horizontal: {
            newScroll: this.adapter.scrollLeft(),
            oldScroll: this.oldScroll.x,
            forward: "right",
            backward: "left"
          },
          vertical: {
            newScroll: this.adapter.scrollTop(),
            oldScroll: this.oldScroll.y,
            forward: "down",
            backward: "up"
          }
        };
      for (var axisKey in axes) {
        var axis = axes[axisKey],
          isForward = axis.newScroll > axis.oldScroll,
          direction = isForward ? axis.forward : axis.backward;
        for (var waypointKey in this.waypoints[axisKey]) {
          var waypoint = this.waypoints[axisKey][waypointKey];
          if (null !== waypoint.triggerPoint) {
            var wasBeforeTriggerPoint = axis.oldScroll < waypoint.triggerPoint,
              nowAfterTriggerPoint = axis.newScroll >= waypoint.triggerPoint,
              crossedForward = wasBeforeTriggerPoint && nowAfterTriggerPoint,
              crossedBackward = !wasBeforeTriggerPoint && !nowAfterTriggerPoint;
            (crossedForward || crossedBackward) && (waypoint.queueTrigger(direction), triggeredGroups[waypoint.group.id] = waypoint.group)
          }
        }
      }
      for (var groupKey in triggeredGroups) triggeredGroups[groupKey].flushTriggers();
      this.oldScroll = {
        x: axes.horizontal.newScroll,
        y: axes.vertical.newScroll
      }
    }, Context.prototype.innerHeight = function () {
      return this.element == this.element.window ? Waypoint.viewportHeight() : this.adapter.innerHeight()
    }, Context.prototype.remove = function (waypoint) {
      delete this.waypoints[waypoint.axis][waypoint.key], this.checkEmpty()
    }, Context.prototype.innerWidth = function () {
      return this.element == this.element.window ? Waypoint.viewportWidth() : this.adapter.innerWidth()
    }, Context.prototype.destroy = function () {
      var allWaypoints = [];
      for (var axis in this.waypoints)
        for (var waypointKey in this.waypoints[axis]) allWaypoints.push(this.waypoints[axis][waypointKey]);
      for (var i = 0, end = allWaypoints.length; i < end; i++) allWaypoints[i].destroy()
    }, Context.prototype.refresh = function () {
      var axes, isWindow = this.element == this.element.window,
        contextOffset = isWindow ? void 0 : this.adapter.offset(),
        triggeredGroups = {};
      this.handleScroll(), axes = {
        horizontal: {
          contextOffset: isWindow ? 0 : contextOffset.left,
          contextScroll: isWindow ? 0 : this.oldScroll.x,
          contextDimension: this.innerWidth(),
          oldScroll: this.oldScroll.x,
          forward: "right",
          backward: "left",
          offsetProp: "left"
        },
        vertical: {
          contextOffset: isWindow ? 0 : contextOffset.top,
          contextScroll: isWindow ? 0 : this.oldScroll.y,
          contextDimension: this.innerHeight(),
          oldScroll: this.oldScroll.y,
          forward: "down",
          backward: "up",
          offsetProp: "top"
        }
      };
      for (var axisKey in axes) {
        var axis = axes[axisKey];
        for (var waypointKey in this.waypoints[axisKey]) {
          var contextModifier, wasBeforeScroll, nowAfterScroll, triggeredBackward, triggeredForward, waypoint = this.waypoints[axisKey][waypointKey],
            adjustment = waypoint.options.offset,
            oldTriggerPoint = waypoint.triggerPoint,
            elementOffset = 0,
            freshWaypoint = null == oldTriggerPoint;
          waypoint.element !== waypoint.element.window && (elementOffset = waypoint.adapter.offset()[axis.offsetProp]), "function" == typeof adjustment ? adjustment = adjustment.apply(waypoint) : "string" == typeof adjustment && (adjustment = parseFloat(adjustment), waypoint.options.offset.indexOf("%") > -1 && (adjustment = Math.ceil(axis.contextDimension * adjustment / 100))), contextModifier = axis.contextScroll - axis.contextOffset, waypoint.triggerPoint = Math.floor(elementOffset + contextModifier - adjustment), wasBeforeScroll = oldTriggerPoint < axis.oldScroll, nowAfterScroll = waypoint.triggerPoint >= axis.oldScroll, triggeredBackward = wasBeforeScroll && nowAfterScroll, triggeredForward = !wasBeforeScroll && !nowAfterScroll, !freshWaypoint && triggeredBackward ? (waypoint.queueTrigger(axis.backward), triggeredGroups[waypoint.group.id] = waypoint.group) : !freshWaypoint && triggeredForward ? (waypoint.queueTrigger(axis.forward), triggeredGroups[waypoint.group.id] = waypoint.group) : freshWaypoint && axis.oldScroll >= waypoint.triggerPoint && (waypoint.queueTrigger(axis.forward), triggeredGroups[waypoint.group.id] = waypoint.group)
        }
      }
      return Waypoint.requestAnimationFrame(function () {
        for (var groupKey in triggeredGroups) triggeredGroups[groupKey].flushTriggers()
      }), this
    }, Context.findOrCreateByElement = function (element) {
      return Context.findByElement(element) || new Context(element)
    }, Context.refreshAll = function () {
      for (var contextId in contexts) contexts[contextId].refresh()
    }, Context.findByElement = function (element) {
      return contexts[element.waypointContextKey]
    }, window.onload = function () {
      oldWindowLoad && oldWindowLoad(), Context.refreshAll()
    }, Waypoint.requestAnimationFrame = function (callback) {
      var requestFn = window.requestAnimationFrame || window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame || requestAnimationFrameShim;
      requestFn.call(window, callback)
    }, Waypoint.Context = Context
  }(),
  function () {
    "use strict";

    function byTriggerPoint(a, b) {
      return a.triggerPoint - b.triggerPoint
    }

    function byReverseTriggerPoint(a, b) {
      return b.triggerPoint - a.triggerPoint
    }

    function Group(options) {
      this.name = options.name, this.axis = options.axis, this.id = this.name + "-" + this.axis, this.waypoints = [], this.clearTriggerQueues(), groups[this.axis][this.name] = this
    }
    var groups = {
      vertical: {},
      horizontal: {}
    },
      Waypoint = window.Waypoint;
    Group.prototype.add = function (waypoint) {
      this.waypoints.push(waypoint)
    }, Group.prototype.clearTriggerQueues = function () {
      this.triggerQueues = {
        up: [],
        down: [],
        left: [],
        right: []
      }
    }, Group.prototype.flushTriggers = function () {
      for (var direction in this.triggerQueues) {
        var waypoints = this.triggerQueues[direction],
          reverse = "up" === direction || "left" === direction;
        waypoints.sort(reverse ? byReverseTriggerPoint : byTriggerPoint);
        for (var i = 0, end = waypoints.length; i < end; i += 1) {
          var waypoint = waypoints[i];
          (waypoint.options.continuous || i === waypoints.length - 1) && waypoint.trigger([direction])
        }
      }
      this.clearTriggerQueues()
    }, Group.prototype.next = function (waypoint) {
      this.waypoints.sort(byTriggerPoint);
      var index = Waypoint.Adapter.inArray(waypoint, this.waypoints),
        isLast = index === this.waypoints.length - 1;
      return isLast ? null : this.waypoints[index + 1]
    }, Group.prototype.previous = function (waypoint) {
      this.waypoints.sort(byTriggerPoint);
      var index = Waypoint.Adapter.inArray(waypoint, this.waypoints);
      return index ? this.waypoints[index - 1] : null
    }, Group.prototype.queueTrigger = function (waypoint, direction) {
      this.triggerQueues[direction].push(waypoint)
    }, Group.prototype.remove = function (waypoint) {
      var index = Waypoint.Adapter.inArray(waypoint, this.waypoints);
      index > -1 && this.waypoints.splice(index, 1)
    }, Group.prototype.first = function () {
      return this.waypoints[0]
    }, Group.prototype.last = function () {
      return this.waypoints[this.waypoints.length - 1]
    }, Group.findOrCreate = function (options) {
      return groups[options.axis][options.name] || new Group(options)
    }, Waypoint.Group = Group
  }(),
  function () {
    "use strict";

    function JQueryAdapter(element) {
      this.$element = $(element)
    }
    var $ = window.jQuery,
      Waypoint = window.Waypoint;
    $.each(["innerHeight", "innerWidth", "off", "offset", "on", "outerHeight", "outerWidth", "scrollLeft", "scrollTop"], function (i, method) {
      JQueryAdapter.prototype[method] = function () {
        var args = Array.prototype.slice.call(arguments);
        return this.$element[method].apply(this.$element, args)
      }
    }), $.each(["extend", "inArray", "isEmptyObject"], function (i, method) {
      JQueryAdapter[method] = $[method]
    }), Waypoint.adapters.push({
      name: "jquery",
      Adapter: JQueryAdapter
    }), Waypoint.Adapter = JQueryAdapter
  }(),
  function () {
    "use strict";

    function createExtension(framework) {
      return function () {
        var waypoints = [],
          overrides = arguments[0];
        return framework.isFunction(arguments[0]) && (overrides = framework.extend({}, arguments[1]), overrides.handler = arguments[0]), this.each(function () {
          var options = framework.extend({}, overrides, {
            element: this
          });
          "string" == typeof options.context && (options.context = framework(this).closest(options.context)[0]), waypoints.push(new Waypoint(options))
        }), waypoints
      }
    }
    var Waypoint = window.Waypoint;
    window.jQuery && (window.jQuery.fn.elementorWaypoint = createExtension(window.jQuery)), window.Zepto && (window.Zepto.fn.elementorWaypoint = createExtension(window.Zepto))
  }();
! function (e, t) {
  "object" == typeof exports && "undefined" != typeof module ? module.exports = t() : "function" == typeof define && define.amd ? define(t) : (e = e || self).Swiper = t()
}(this, (function () {
  "use strict";
  var e = "undefined" == typeof document ? {
    body: {},
    addEventListener: function () { },
    removeEventListener: function () { },
    activeElement: {
      blur: function () { },
      nodeName: ""
    },
    querySelector: function () {
      return null
    },
    querySelectorAll: function () {
      return []
    },
    getElementById: function () {
      return null
    },
    createEvent: function () {
      return {
        initEvent: function () { }
      }
    },
    createElement: function () {
      return {
        children: [],
        childNodes: [],
        style: {},
        setAttribute: function () { },
        getElementsByTagName: function () {
          return []
        }
      }
    },
    location: {
      hash: ""
    }
  } : document,
    t = "undefined" == typeof window ? {
      document: e,
      navigator: {
        userAgent: ""
      },
      location: {},
      history: {},
      CustomEvent: function () {
        return this
      },
      addEventListener: function () { },
      removeEventListener: function () { },
      getComputedStyle: function () {
        return {
          getPropertyValue: function () {
            return ""
          }
        }
      },
      Image: function () { },
      Date: function () { },
      screen: {},
      setTimeout: function () { },
      clearTimeout: function () { }
    } : window,
    i = function (e) {
      for (var t = 0; t < e.length; t += 1) this[t] = e[t];
      return this.length = e.length, this
    };

  function s(s, a) {
    var r = [],
      n = 0;
    if (s && !a && s instanceof i) return s;
    if (s)
      if ("string" == typeof s) {
        var o, l, d = s.trim();
        if (d.indexOf("<") >= 0 && d.indexOf(">") >= 0) {
          var h = "div";
          for (0 === d.indexOf("<li") && (h = "ul"), 0 === d.indexOf("<tr") && (h = "tbody"), 0 !== d.indexOf("<td") && 0 !== d.indexOf("<th") || (h = "tr"), 0 === d.indexOf("<tbody") && (h = "table"), 0 === d.indexOf("<option") && (h = "select"), (l = e.createElement(h)).innerHTML = d, n = 0; n < l.childNodes.length; n += 1) r.push(l.childNodes[n])
        } else
          for (o = a || "#" !== s[0] || s.match(/[ .<>:~]/) ? (a || e).querySelectorAll(s.trim()) : [e.getElementById(s.trim().split("#")[1])], n = 0; n < o.length; n += 1) o[n] && r.push(o[n])
      } else if (s.nodeType || s === t || s === e) r.push(s);
      else if (s.length > 0 && s[0].nodeType)
        for (n = 0; n < s.length; n += 1) r.push(s[n]);
    return new i(r)
  }

  function a(e) {
    for (var t = [], i = 0; i < e.length; i += 1) - 1 === t.indexOf(e[i]) && t.push(e[i]);
    return t
  }
  s.fn = i.prototype, s.Class = i, s.Dom7 = i;
  var r = {
    addClass: function (e) {
      if (void 0 === e) return this;
      for (var t = e.split(" "), i = 0; i < t.length; i += 1)
        for (var s = 0; s < this.length; s += 1) void 0 !== this[s] && void 0 !== this[s].classList && this[s].classList.add(t[i]);
      return this
    },
    removeClass: function (e) {
      for (var t = e.split(" "), i = 0; i < t.length; i += 1)
        for (var s = 0; s < this.length; s += 1) void 0 !== this[s] && void 0 !== this[s].classList && this[s].classList.remove(t[i]);
      return this
    },
    hasClass: function (e) {
      return !!this[0] && this[0].classList.contains(e)
    },
    toggleClass: function (e) {
      for (var t = e.split(" "), i = 0; i < t.length; i += 1)
        for (var s = 0; s < this.length; s += 1) void 0 !== this[s] && void 0 !== this[s].classList && this[s].classList.toggle(t[i]);
      return this
    },
    attr: function (e, t) {
      var i = arguments;
      if (1 === arguments.length && "string" == typeof e) return this[0] ? this[0].getAttribute(e) : void 0;
      for (var s = 0; s < this.length; s += 1)
        if (2 === i.length) this[s].setAttribute(e, t);
        else
          for (var a in e) this[s][a] = e[a], this[s].setAttribute(a, e[a]);
      return this
    },
    removeAttr: function (e) {
      for (var t = 0; t < this.length; t += 1) this[t].removeAttribute(e);
      return this
    },
    data: function (e, t) {
      var i;
      if (void 0 !== t) {
        for (var s = 0; s < this.length; s += 1)(i = this[s]).dom7ElementDataStorage || (i.dom7ElementDataStorage = {}), i.dom7ElementDataStorage[e] = t;
        return this
      }
      if (i = this[0]) {
        if (i.dom7ElementDataStorage && e in i.dom7ElementDataStorage) return i.dom7ElementDataStorage[e];
        var a = i.getAttribute("data-" + e);
        return a || void 0
      }
    },
    transform: function (e) {
      for (var t = 0; t < this.length; t += 1) {
        var i = this[t].style;
        i.webkitTransform = e, i.transform = e
      }
      return this
    },
    transition: function (e) {
      "string" != typeof e && (e += "ms");
      for (var t = 0; t < this.length; t += 1) {
        var i = this[t].style;
        i.webkitTransitionDuration = e, i.transitionDuration = e
      }
      return this
    },
    on: function () {
      for (var e, t = [], i = arguments.length; i--;) t[i] = arguments[i];
      var a = t[0],
        r = t[1],
        n = t[2],
        o = t[3];

      function l(e) {
        var t = e.target;
        if (t) {
          var i = e.target.dom7EventData || [];
          if (i.indexOf(e) < 0 && i.unshift(e), s(t).is(r)) n.apply(t, i);
          else
            for (var a = s(t).parents(), o = 0; o < a.length; o += 1) s(a[o]).is(r) && n.apply(a[o], i)
        }
      }

      function d(e) {
        var t = e && e.target && e.target.dom7EventData || [];
        t.indexOf(e) < 0 && t.unshift(e), n.apply(this, t)
      }
      "function" == typeof t[1] && (a = (e = t)[0], n = e[1], o = e[2], r = void 0), o || (o = !1);
      for (var h, p = a.split(" "), c = 0; c < this.length; c += 1) {
        var u = this[c];
        if (r)
          for (h = 0; h < p.length; h += 1) {
            var v = p[h];
            u.dom7LiveListeners || (u.dom7LiveListeners = {}), u.dom7LiveListeners[v] || (u.dom7LiveListeners[v] = []), u.dom7LiveListeners[v].push({
              listener: n,
              proxyListener: l
            }), u.addEventListener(v, l, o)
          } else
          for (h = 0; h < p.length; h += 1) {
            var f = p[h];
            u.dom7Listeners || (u.dom7Listeners = {}), u.dom7Listeners[f] || (u.dom7Listeners[f] = []), u.dom7Listeners[f].push({
              listener: n,
              proxyListener: d
            }), u.addEventListener(f, d, o)
          }
      }
      return this
    },
    off: function () {
      for (var e, t = [], i = arguments.length; i--;) t[i] = arguments[i];
      var s = t[0],
        a = t[1],
        r = t[2],
        n = t[3];
      "function" == typeof t[1] && (s = (e = t)[0], r = e[1], n = e[2], a = void 0), n || (n = !1);
      for (var o = s.split(" "), l = 0; l < o.length; l += 1)
        for (var d = o[l], h = 0; h < this.length; h += 1) {
          var p = this[h],
            c = void 0;
          if (!a && p.dom7Listeners ? c = p.dom7Listeners[d] : a && p.dom7LiveListeners && (c = p.dom7LiveListeners[d]), c && c.length)
            for (var u = c.length - 1; u >= 0; u -= 1) {
              var v = c[u];
              r && v.listener === r ? (p.removeEventListener(d, v.proxyListener, n), c.splice(u, 1)) : r && v.listener && v.listener.dom7proxy && v.listener.dom7proxy === r ? (p.removeEventListener(d, v.proxyListener, n), c.splice(u, 1)) : r || (p.removeEventListener(d, v.proxyListener, n), c.splice(u, 1))
            }
        }
      return this
    },
    trigger: function () {
      for (var i = [], s = arguments.length; s--;) i[s] = arguments[s];
      for (var a = i[0].split(" "), r = i[1], n = 0; n < a.length; n += 1)
        for (var o = a[n], l = 0; l < this.length; l += 1) {
          var d = this[l],
            h = void 0;
          try {
            h = new t.CustomEvent(o, {
              detail: r,
              bubbles: !0,
              cancelable: !0
            })
          } catch (t) {
            (h = e.createEvent("Event")).initEvent(o, !0, !0), h.detail = r
          }
          d.dom7EventData = i.filter((function (e, t) {
            return t > 0
          })), d.dispatchEvent(h), d.dom7EventData = [], delete d.dom7EventData
        }
      return this
    },
    transitionEnd: function (e) {
      var t, i = ["webkitTransitionEnd", "transitionend"],
        s = this;

      function a(r) {
        if (r.target === this)
          for (e.call(this, r), t = 0; t < i.length; t += 1) s.off(i[t], a)
      }
      if (e)
        for (t = 0; t < i.length; t += 1) s.on(i[t], a);
      return this
    },
    outerWidth: function (e) {
      if (this.length > 0) {
        if (e) {
          var t = this.styles();
          return this[0].offsetWidth + parseFloat(t.getPropertyValue("margin-right")) + parseFloat(t.getPropertyValue("margin-left"))
        }
        return this[0].offsetWidth
      }
      return null
    },
    outerHeight: function (e) {
      if (this.length > 0) {
        if (e) {
          var t = this.styles();
          return this[0].offsetHeight + parseFloat(t.getPropertyValue("margin-top")) + parseFloat(t.getPropertyValue("margin-bottom"))
        }
        return this[0].offsetHeight
      }
      return null
    },
    offset: function () {
      if (this.length > 0) {
        var i = this[0],
          s = i.getBoundingClientRect(),
          a = e.body,
          r = i.clientTop || a.clientTop || 0,
          n = i.clientLeft || a.clientLeft || 0,
          o = i === t ? t.scrollY : i.scrollTop,
          l = i === t ? t.scrollX : i.scrollLeft;
        return {
          top: s.top + o - r,
          left: s.left + l - n
        }
      }
      return null
    },
    css: function (e, i) {
      var s;
      if (1 === arguments.length) {
        if ("string" != typeof e) {
          for (s = 0; s < this.length; s += 1)
            for (var a in e) this[s].style[a] = e[a];
          return this
        }
        if (this[0]) return t.getComputedStyle(this[0], null).getPropertyValue(e)
      }
      if (2 === arguments.length && "string" == typeof e) {
        for (s = 0; s < this.length; s += 1) this[s].style[e] = i;
        return this
      }
      return this
    },
    each: function (e) {
      if (!e) return this;
      for (var t = 0; t < this.length; t += 1)
        if (!1 === e.call(this[t], t, this[t])) return this;
      return this
    },
    html: function (e) {
      if (void 0 === e) return this[0] ? this[0].innerHTML : void 0;
      for (var t = 0; t < this.length; t += 1) this[t].innerHTML = e;
      return this
    },
    text: function (e) {
      if (void 0 === e) return this[0] ? this[0].textContent.trim() : null;
      for (var t = 0; t < this.length; t += 1) this[t].textContent = e;
      return this
    },
    is: function (a) {
      var r, n, o = this[0];
      if (!o || void 0 === a) return !1;
      if ("string" == typeof a) {
        if (o.matches) return o.matches(a);
        if (o.webkitMatchesSelector) return o.webkitMatchesSelector(a);
        if (o.msMatchesSelector) return o.msMatchesSelector(a);
        for (r = s(a), n = 0; n < r.length; n += 1)
          if (r[n] === o) return !0;
        return !1
      }
      if (a === e) return o === e;
      if (a === t) return o === t;
      if (a.nodeType || a instanceof i) {
        for (r = a.nodeType ? [a] : a, n = 0; n < r.length; n += 1)
          if (r[n] === o) return !0;
        return !1
      }
      return !1
    },
    index: function () {
      var e, t = this[0];
      if (t) {
        for (e = 0; null !== (t = t.previousSibling);) 1 === t.nodeType && (e += 1);
        return e
      }
    },
    eq: function (e) {
      if (void 0 === e) return this;
      var t, s = this.length;
      return new i(e > s - 1 ? [] : e < 0 ? (t = s + e) < 0 ? [] : [this[t]] : [this[e]])
    },
    append: function () {
      for (var t, s = [], a = arguments.length; a--;) s[a] = arguments[a];
      for (var r = 0; r < s.length; r += 1) {
        t = s[r];
        for (var n = 0; n < this.length; n += 1)
          if ("string" == typeof t) {
            var o = e.createElement("div");
            for (o.innerHTML = t; o.firstChild;) this[n].appendChild(o.firstChild)
          } else if (t instanceof i)
            for (var l = 0; l < t.length; l += 1) this[n].appendChild(t[l]);
          else this[n].appendChild(t)
      }
      return this
    },
    prepend: function (t) {
      var s, a;
      for (s = 0; s < this.length; s += 1)
        if ("string" == typeof t) {
          var r = e.createElement("div");
          for (r.innerHTML = t, a = r.childNodes.length - 1; a >= 0; a -= 1) this[s].insertBefore(r.childNodes[a], this[s].childNodes[0])
        } else if (t instanceof i)
          for (a = 0; a < t.length; a += 1) this[s].insertBefore(t[a], this[s].childNodes[0]);
        else this[s].insertBefore(t, this[s].childNodes[0]);
      return this
    },
    next: function (e) {
      return this.length > 0 ? e ? this[0].nextElementSibling && s(this[0].nextElementSibling).is(e) ? new i([this[0].nextElementSibling]) : new i([]) : this[0].nextElementSibling ? new i([this[0].nextElementSibling]) : new i([]) : new i([])
    },
    nextAll: function (e) {
      var t = [],
        a = this[0];
      if (!a) return new i([]);
      for (; a.nextElementSibling;) {
        var r = a.nextElementSibling;
        e ? s(r).is(e) && t.push(r) : t.push(r), a = r
      }
      return new i(t)
    },
    prev: function (e) {
      if (this.length > 0) {
        var t = this[0];
        return e ? t.previousElementSibling && s(t.previousElementSibling).is(e) ? new i([t.previousElementSibling]) : new i([]) : t.previousElementSibling ? new i([t.previousElementSibling]) : new i([])
      }
      return new i([])
    },
    prevAll: function (e) {
      var t = [],
        a = this[0];
      if (!a) return new i([]);
      for (; a.previousElementSibling;) {
        var r = a.previousElementSibling;
        e ? s(r).is(e) && t.push(r) : t.push(r), a = r
      }
      return new i(t)
    },
    parent: function (e) {
      for (var t = [], i = 0; i < this.length; i += 1) null !== this[i].parentNode && (e ? s(this[i].parentNode).is(e) && t.push(this[i].parentNode) : t.push(this[i].parentNode));
      return s(a(t))
    },
    parents: function (e) {
      for (var t = [], i = 0; i < this.length; i += 1)
        for (var r = this[i].parentNode; r;) e ? s(r).is(e) && t.push(r) : t.push(r), r = r.parentNode;
      return s(a(t))
    },
    closest: function (e) {
      var t = this;
      return void 0 === e ? new i([]) : (t.is(e) || (t = t.parents(e).eq(0)), t)
    },
    find: function (e) {
      for (var t = [], s = 0; s < this.length; s += 1)
        for (var a = this[s].querySelectorAll(e), r = 0; r < a.length; r += 1) t.push(a[r]);
      return new i(t)
    },
    children: function (e) {
      for (var t = [], r = 0; r < this.length; r += 1)
        for (var n = this[r].childNodes, o = 0; o < n.length; o += 1) e ? 1 === n[o].nodeType && s(n[o]).is(e) && t.push(n[o]) : 1 === n[o].nodeType && t.push(n[o]);
      return new i(a(t))
    },
    filter: function (e) {
      for (var t = [], s = 0; s < this.length; s += 1) e.call(this[s], s, this[s]) && t.push(this[s]);
      return new i(t)
    },
    remove: function () {
      for (var e = 0; e < this.length; e += 1) this[e].parentNode && this[e].parentNode.removeChild(this[e]);
      return this
    },
    add: function () {
      for (var e = [], t = arguments.length; t--;) e[t] = arguments[t];
      var i, a;
      for (i = 0; i < e.length; i += 1) {
        var r = s(e[i]);
        for (a = 0; a < r.length; a += 1) this[this.length] = r[a], this.length += 1
      }
      return this
    },
    styles: function () {
      return this[0] ? t.getComputedStyle(this[0], null) : {}
    }
  };
  Object.keys(r).forEach((function (e) {
    s.fn[e] = s.fn[e] || r[e]
  }));
  var n = {
    deleteProps: function (e) {
      var t = e;
      Object.keys(t).forEach((function (e) {
        try {
          t[e] = null
        } catch (e) { }
        try {
          delete t[e]
        } catch (e) { }
      }))
    },
    nextTick: function (e, t) {
      return void 0 === t && (t = 0), setTimeout(e, t)
    },
    now: function () {
      return Date.now()
    },
    getTranslate: function (e, i) {
      var s, a, r;
      void 0 === i && (i = "x");
      var n = t.getComputedStyle(e, null);
      return t.WebKitCSSMatrix ? ((a = n.transform || n.webkitTransform).split(",").length > 6 && (a = a.split(", ").map((function (e) {
        return e.replace(",", ".")
      })).join(", ")), r = new t.WebKitCSSMatrix("none" === a ? "" : a)) : s = (r = n.MozTransform || n.OTransform || n.MsTransform || n.msTransform || n.transform || n.getPropertyValue("transform").replace("translate(", "matrix(1, 0, 0, 1,")).toString().split(","), "x" === i && (a = t.WebKitCSSMatrix ? r.m41 : 16 === s.length ? parseFloat(s[12]) : parseFloat(s[4])), "y" === i && (a = t.WebKitCSSMatrix ? r.m42 : 16 === s.length ? parseFloat(s[13]) : parseFloat(s[5])), a || 0
    },
    parseUrlQuery: function (e) {
      var i, s, a, r, n = {},
        o = e || t.location.href;
      if ("string" == typeof o && o.length)
        for (r = (s = (o = o.indexOf("?") > -1 ? o.replace(/\S*\?/, "") : "").split("&").filter((function (e) {
          return "" !== e
        }))).length, i = 0; i < r; i += 1) a = s[i].replace(/#\S+/g, "").split("="), n[decodeURIComponent(a[0])] = void 0 === a[1] ? void 0 : decodeURIComponent(a[1]) || "";
      return n
    },
    isObject: function (e) {
      return "object" == typeof e && null !== e && e.constructor && e.constructor === Object
    },
    extend: function () {
      for (var e = [], t = arguments.length; t--;) e[t] = arguments[t];
      for (var i = Object(e[0]), s = 1; s < e.length; s += 1) {
        var a = e[s];
        if (null != a)
          for (var r = Object.keys(Object(a)), o = 0, l = r.length; o < l; o += 1) {
            var d = r[o],
              h = Object.getOwnPropertyDescriptor(a, d);
            void 0 !== h && h.enumerable && (n.isObject(i[d]) && n.isObject(a[d]) ? n.extend(i[d], a[d]) : !n.isObject(i[d]) && n.isObject(a[d]) ? (i[d] = {}, n.extend(i[d], a[d])) : i[d] = a[d])
          }
      }
      return i
    }
  },
    o = {
      touch: t.Modernizr && !0 === t.Modernizr.touch || !!(t.navigator.maxTouchPoints > 0 || "ontouchstart" in t || t.DocumentTouch && e instanceof t.DocumentTouch),
      pointerEvents: !!t.PointerEvent && "maxTouchPoints" in t.navigator && t.navigator.maxTouchPoints > 0,
      observer: "MutationObserver" in t || "WebkitMutationObserver" in t,
      passiveListener: function () {
        var e = !1;
        try {
          var i = Object.defineProperty({}, "passive", {
            get: function () {
              e = !0
            }
          });
          t.addEventListener("testPassiveListener", null, i)
        } catch (e) { }
        return e
      }(),
      gestures: "ongesturestart" in t
    },
    l = function (e) {
      void 0 === e && (e = {});
      var t = this;
      t.params = e, t.eventsListeners = {}, t.params && t.params.on && Object.keys(t.params.on).forEach((function (e) {
        t.on(e, t.params.on[e])
      }))
    },
    d = {
      components: {
        configurable: !0
      }
    };
  l.prototype.on = function (e, t, i) {
    var s = this;
    if ("function" != typeof t) return s;
    var a = i ? "unshift" : "push";
    return e.split(" ").forEach((function (e) {
      s.eventsListeners[e] || (s.eventsListeners[e] = []), s.eventsListeners[e][a](t)
    })), s
  }, l.prototype.once = function (e, t, i) {
    var s = this;
    if ("function" != typeof t) return s;

    function a() {
      for (var i = [], r = arguments.length; r--;) i[r] = arguments[r];
      s.off(e, a), a.f7proxy && delete a.f7proxy, t.apply(s, i)
    }
    return a.f7proxy = t, s.on(e, a, i)
  }, l.prototype.off = function (e, t) {
    var i = this;
    return i.eventsListeners ? (e.split(" ").forEach((function (e) {
      void 0 === t ? i.eventsListeners[e] = [] : i.eventsListeners[e] && i.eventsListeners[e].length && i.eventsListeners[e].forEach((function (s, a) {
        (s === t || s.f7proxy && s.f7proxy === t) && i.eventsListeners[e].splice(a, 1)
      }))
    })), i) : i
  }, l.prototype.emit = function () {
    for (var e = [], t = arguments.length; t--;) e[t] = arguments[t];
    var i, s, a, r = this;
    if (!r.eventsListeners) return r;
    "string" == typeof e[0] || Array.isArray(e[0]) ? (i = e[0], s = e.slice(1, e.length), a = r) : (i = e[0].events, s = e[0].data, a = e[0].context || r);
    var n = Array.isArray(i) ? i : i.split(" ");
    return n.forEach((function (e) {
      if (r.eventsListeners && r.eventsListeners[e]) {
        var t = [];
        r.eventsListeners[e].forEach((function (e) {
          t.push(e)
        })), t.forEach((function (e) {
          e.apply(a, s)
        }))
      }
    })), r
  }, l.prototype.useModulesParams = function (e) {
    var t = this;
    t.modules && Object.keys(t.modules).forEach((function (i) {
      var s = t.modules[i];
      s.params && n.extend(e, s.params)
    }))
  }, l.prototype.useModules = function (e) {
    void 0 === e && (e = {});
    var t = this;
    t.modules && Object.keys(t.modules).forEach((function (i) {
      var s = t.modules[i],
        a = e[i] || {};
      s.instance && Object.keys(s.instance).forEach((function (e) {
        var i = s.instance[e];
        t[e] = "function" == typeof i ? i.bind(t) : i
      })), s.on && t.on && Object.keys(s.on).forEach((function (e) {
        t.on(e, s.on[e])
      })), s.create && s.create.bind(t)(a)
    }))
  }, d.components.set = function (e) {
    this.use && this.use(e)
  }, l.installModule = function (e) {
    for (var t = [], i = arguments.length - 1; i-- > 0;) t[i] = arguments[i + 1];
    var s = this;
    s.prototype.modules || (s.prototype.modules = {});
    var a = e.name || Object.keys(s.prototype.modules).length + "_" + n.now();
    return s.prototype.modules[a] = e, e.proto && Object.keys(e.proto).forEach((function (t) {
      s.prototype[t] = e.proto[t]
    })), e.static && Object.keys(e.static).forEach((function (t) {
      s[t] = e.static[t]
    })), e.install && e.install.apply(s, t), s
  }, l.use = function (e) {
    for (var t = [], i = arguments.length - 1; i-- > 0;) t[i] = arguments[i + 1];
    var s = this;
    return Array.isArray(e) ? (e.forEach((function (e) {
      return s.installModule(e)
    })), s) : s.installModule.apply(s, [e].concat(t))
  }, Object.defineProperties(l, d);
  var h = {
    updateSize: function () {
      var e, t, i = this.$el;
      e = void 0 !== this.params.width ? this.params.width : i[0].clientWidth, t = void 0 !== this.params.height ? this.params.height : i[0].clientHeight, 0 === e && this.isHorizontal() || 0 === t && this.isVertical() || (e = e - parseInt(i.css("padding-left"), 10) - parseInt(i.css("padding-right"), 10), t = t - parseInt(i.css("padding-top"), 10) - parseInt(i.css("padding-bottom"), 10), n.extend(this, {
        width: e,
        height: t,
        size: this.isHorizontal() ? e : t
      }))
    },
    updateSlides: function () {
      var e = this.params,
        i = this.$wrapperEl,
        s = this.size,
        a = this.rtlTranslate,
        r = this.wrongRTL,
        o = this.virtual && e.virtual.enabled,
        l = o ? this.virtual.slides.length : this.slides.length,
        d = i.children("." + this.params.slideClass),
        h = o ? this.virtual.slides.length : d.length,
        p = [],
        c = [],
        u = [];

      function v(t) {
        return !e.cssMode || t !== d.length - 1
      }
      var f = e.slidesOffsetBefore;
      "function" == typeof f && (f = e.slidesOffsetBefore.call(this));
      var m = e.slidesOffsetAfter;
      "function" == typeof m && (m = e.slidesOffsetAfter.call(this));
      var g = this.snapGrid.length,
        b = this.snapGrid.length,
        w = e.spaceBetween,
        y = -f,
        x = 0,
        T = 0;
      if (void 0 !== s) {
        var E, S;
        "string" == typeof w && w.indexOf("%") >= 0 && (w = parseFloat(w.replace("%", "")) / 100 * s), this.virtualSize = -w, a ? d.css({
          marginLeft: "",
          marginTop: ""
        }) : d.css({
          marginRight: "",
          marginBottom: ""
        }), e.slidesPerColumn > 1 && (E = Math.floor(h / e.slidesPerColumn) === h / this.params.slidesPerColumn ? h : Math.ceil(h / e.slidesPerColumn) * e.slidesPerColumn, "auto" !== e.slidesPerView && "row" === e.slidesPerColumnFill && (E = Math.max(E, e.slidesPerView * e.slidesPerColumn)));
        for (var C, M = e.slidesPerColumn, P = E / M, z = Math.floor(h / e.slidesPerColumn), k = 0; k < h; k += 1) {
          S = 0;
          var $ = d.eq(k);
          if (e.slidesPerColumn > 1) {
            var L = void 0,
              I = void 0,
              D = void 0;
            if ("row" === e.slidesPerColumnFill && e.slidesPerGroup > 1) {
              var O = Math.floor(k / (e.slidesPerGroup * e.slidesPerColumn)),
                A = k - e.slidesPerColumn * e.slidesPerGroup * O,
                G = 0 === O ? e.slidesPerGroup : Math.min(Math.ceil((h - O * M * e.slidesPerGroup) / M), e.slidesPerGroup);
              L = (I = A - (D = Math.floor(A / G)) * G + O * e.slidesPerGroup) + D * E / M, $.css({
                "-webkit-box-ordinal-group": L,
                "-moz-box-ordinal-group": L,
                "-ms-flex-order": L,
                "-webkit-order": L,
                order: L
              })
            } else "column" === e.slidesPerColumnFill ? (D = k - (I = Math.floor(k / M)) * M, (I > z || I === z && D === M - 1) && (D += 1) >= M && (D = 0, I += 1)) : I = k - (D = Math.floor(k / P)) * P;
            $.css("margin-" + (this.isHorizontal() ? "top" : "left"), 0 !== D && e.spaceBetween && e.spaceBetween + "px")
          }
          if ("none" !== $.css("display")) {
            if ("auto" === e.slidesPerView) {
              var H = t.getComputedStyle($[0], null),
                B = $[0].style.transform,
                N = $[0].style.webkitTransform;
              if (B && ($[0].style.transform = "none"), N && ($[0].style.webkitTransform = "none"), e.roundLengths) S = this.isHorizontal() ? $.outerWidth(!0) : $.outerHeight(!0);
              else if (this.isHorizontal()) {
                var X = parseFloat(H.getPropertyValue("width")),
                  V = parseFloat(H.getPropertyValue("padding-left")),
                  Y = parseFloat(H.getPropertyValue("padding-right")),
                  F = parseFloat(H.getPropertyValue("margin-left")),
                  W = parseFloat(H.getPropertyValue("margin-right")),
                  R = H.getPropertyValue("box-sizing");
                S = R && "border-box" === R ? X + F + W : X + V + Y + F + W
              } else {
                var q = parseFloat(H.getPropertyValue("height")),
                  j = parseFloat(H.getPropertyValue("padding-top")),
                  K = parseFloat(H.getPropertyValue("padding-bottom")),
                  U = parseFloat(H.getPropertyValue("margin-top")),
                  _ = parseFloat(H.getPropertyValue("margin-bottom")),
                  Z = H.getPropertyValue("box-sizing");
                S = Z && "border-box" === Z ? q + U + _ : q + j + K + U + _
              }
              B && ($[0].style.transform = B), N && ($[0].style.webkitTransform = N), e.roundLengths && (S = Math.floor(S))
            } else S = (s - (e.slidesPerView - 1) * w) / e.slidesPerView, e.roundLengths && (S = Math.floor(S)), d[k] && (this.isHorizontal() ? d[k].style.width = S + "px" : d[k].style.height = S + "px");
            d[k] && (d[k].swiperSlideSize = S), u.push(S), e.centeredSlides ? (y = y + S / 2 + x / 2 + w, 0 === x && 0 !== k && (y = y - s / 2 - w), 0 === k && (y = y - s / 2 - w), Math.abs(y) < .001 && (y = 0), e.roundLengths && (y = Math.floor(y)), T % e.slidesPerGroup == 0 && p.push(y), c.push(y)) : (e.roundLengths && (y = Math.floor(y)), (T - Math.min(this.params.slidesPerGroupSkip, T)) % this.params.slidesPerGroup == 0 && p.push(y), c.push(y), y = y + S + w), this.virtualSize += S + w, x = S, T += 1
          }
        }
        if (this.virtualSize = Math.max(this.virtualSize, s) + m, a && r && ("slide" === e.effect || "coverflow" === e.effect) && i.css({
          width: this.virtualSize + e.spaceBetween + "px"
        }), e.setWrapperSize && (this.isHorizontal() ? i.css({
          width: this.virtualSize + e.spaceBetween + "px"
        }) : i.css({
          height: this.virtualSize + e.spaceBetween + "px"
        })), e.slidesPerColumn > 1 && (this.virtualSize = (S + e.spaceBetween) * E, this.virtualSize = Math.ceil(this.virtualSize / e.slidesPerColumn) - e.spaceBetween, this.isHorizontal() ? i.css({
          width: this.virtualSize + e.spaceBetween + "px"
        }) : i.css({
          height: this.virtualSize + e.spaceBetween + "px"
        }), e.centeredSlides)) {
          C = [];
          for (var Q = 0; Q < p.length; Q += 1) {
            var J = p[Q];
            e.roundLengths && (J = Math.floor(J)), p[Q] < this.virtualSize + p[0] && C.push(J)
          }
          p = C
        }
        if (!e.centeredSlides) {
          C = [];
          for (var ee = 0; ee < p.length; ee += 1) {
            var te = p[ee];
            e.roundLengths && (te = Math.floor(te)), p[ee] <= this.virtualSize - s && C.push(te)
          }
          p = C, Math.floor(this.virtualSize - s) - Math.floor(p[p.length - 1]) > 1 && p.push(this.virtualSize - s)
        }
        if (0 === p.length && (p = [0]), 0 !== e.spaceBetween && (this.isHorizontal() ? a ? d.filter(v).css({
          marginLeft: w + "px"
        }) : d.filter(v).css({
          marginRight: w + "px"
        }) : d.filter(v).css({
          marginBottom: w + "px"
        })), e.centeredSlides && e.centeredSlidesBounds) {
          var ie = 0;
          u.forEach((function (t) {
            ie += t + (e.spaceBetween ? e.spaceBetween : 0)
          }));
          var se = (ie -= e.spaceBetween) - s;
          p = p.map((function (e) {
            return e < 0 ? -f : e > se ? se + m : e
          }))
        }
        if (e.centerInsufficientSlides) {
          var ae = 0;
          if (u.forEach((function (t) {
            ae += t + (e.spaceBetween ? e.spaceBetween : 0)
          })), (ae -= e.spaceBetween) < s) {
            var re = (s - ae) / 2;
            p.forEach((function (e, t) {
              p[t] = e - re
            })), c.forEach((function (e, t) {
              c[t] = e + re
            }))
          }
        }
        n.extend(this, {
          slides: d,
          snapGrid: p,
          slidesGrid: c,
          slidesSizesGrid: u
        }), h !== l && this.emit("slidesLengthChange"), p.length !== g && (this.params.watchOverflow && this.checkOverflow(), this.emit("snapGridLengthChange")), c.length !== b && this.emit("slidesGridLengthChange"), (e.watchSlidesProgress || e.watchSlidesVisibility) && this.updateSlidesOffset()
      }
    },
    updateAutoHeight: function (e) {
      var t, i = [],
        s = 0;
      if ("number" == typeof e ? this.setTransition(e) : !0 === e && this.setTransition(this.params.speed), "auto" !== this.params.slidesPerView && this.params.slidesPerView > 1)
        if (this.params.centeredSlides) i.push.apply(i, this.visibleSlides);
        else
          for (t = 0; t < Math.ceil(this.params.slidesPerView); t += 1) {
            var a = this.activeIndex + t;
            if (a > this.slides.length) break;
            i.push(this.slides.eq(a)[0])
          } else i.push(this.slides.eq(this.activeIndex)[0]);
      for (t = 0; t < i.length; t += 1)
        if (void 0 !== i[t]) {
          var r = i[t].offsetHeight;
          s = r > s ? r : s
        }
      s && this.$wrapperEl.css("height", s + "px")
    },
    updateSlidesOffset: function () {
      for (var e = this.slides, t = 0; t < e.length; t += 1) e[t].swiperSlideOffset = this.isHorizontal() ? e[t].offsetLeft : e[t].offsetTop
    },
    updateSlidesProgress: function (e) {
      void 0 === e && (e = this && this.translate || 0);
      var t = this.params,
        i = this.slides,
        a = this.rtlTranslate;
      if (0 !== i.length) {
        void 0 === i[0].swiperSlideOffset && this.updateSlidesOffset();
        var r = -e;
        a && (r = e), i.removeClass(t.slideVisibleClass), this.visibleSlidesIndexes = [], this.visibleSlides = [];
        for (var n = 0; n < i.length; n += 1) {
          var o = i[n],
            l = (r + (t.centeredSlides ? this.minTranslate() : 0) - o.swiperSlideOffset) / (o.swiperSlideSize + t.spaceBetween);
          if (t.watchSlidesVisibility || t.centeredSlides && t.autoHeight) {
            var d = -(r - o.swiperSlideOffset),
              h = d + this.slidesSizesGrid[n];
            (d >= 0 && d < this.size - 1 || h > 1 && h <= this.size || d <= 0 && h >= this.size) && (this.visibleSlides.push(o), this.visibleSlidesIndexes.push(n), i.eq(n).addClass(t.slideVisibleClass))
          }
          o.progress = a ? -l : l
        }
        this.visibleSlides = s(this.visibleSlides)
      }
    },
    updateProgress: function (e) {
      if (void 0 === e) {
        var t = this.rtlTranslate ? -1 : 1;
        e = this && this.translate && this.translate * t || 0
      }
      var i = this.params,
        s = this.maxTranslate() - this.minTranslate(),
        a = this.progress,
        r = this.isBeginning,
        o = this.isEnd,
        l = r,
        d = o;
      0 === s ? (a = 0, r = !0, o = !0) : (r = (a = (e - this.minTranslate()) / s) <= 0, o = a >= 1), n.extend(this, {
        progress: a,
        isBeginning: r,
        isEnd: o
      }), (i.watchSlidesProgress || i.watchSlidesVisibility || i.centeredSlides && i.autoHeight) && this.updateSlidesProgress(e), r && !l && this.emit("reachBeginning toEdge"), o && !d && this.emit("reachEnd toEdge"), (l && !r || d && !o) && this.emit("fromEdge"), this.emit("progress", a)
    },
    updateSlidesClasses: function () {
      var e, t = this.slides,
        i = this.params,
        s = this.$wrapperEl,
        a = this.activeIndex,
        r = this.realIndex,
        n = this.virtual && i.virtual.enabled;
      t.removeClass(i.slideActiveClass + " " + i.slideNextClass + " " + i.slidePrevClass + " " + i.slideDuplicateActiveClass + " " + i.slideDuplicateNextClass + " " + i.slideDuplicatePrevClass), (e = n ? this.$wrapperEl.find("." + i.slideClass + '[data-swiper-slide-index="' + a + '"]') : t.eq(a)).addClass(i.slideActiveClass), i.loop && (e.hasClass(i.slideDuplicateClass) ? s.children("." + i.slideClass + ":not(." + i.slideDuplicateClass + ')[data-swiper-slide-index="' + r + '"]').addClass(i.slideDuplicateActiveClass) : s.children("." + i.slideClass + "." + i.slideDuplicateClass + '[data-swiper-slide-index="' + r + '"]').addClass(i.slideDuplicateActiveClass));
      var o = e.nextAll("." + i.slideClass).eq(0).addClass(i.slideNextClass);
      i.loop && 0 === o.length && (o = t.eq(0)).addClass(i.slideNextClass);
      var l = e.prevAll("." + i.slideClass).eq(0).addClass(i.slidePrevClass);
      i.loop && 0 === l.length && (l = t.eq(-1)).addClass(i.slidePrevClass), i.loop && (o.hasClass(i.slideDuplicateClass) ? s.children("." + i.slideClass + ":not(." + i.slideDuplicateClass + ')[data-swiper-slide-index="' + o.attr("data-swiper-slide-index") + '"]').addClass(i.slideDuplicateNextClass) : s.children("." + i.slideClass + "." + i.slideDuplicateClass + '[data-swiper-slide-index="' + o.attr("data-swiper-slide-index") + '"]').addClass(i.slideDuplicateNextClass), l.hasClass(i.slideDuplicateClass) ? s.children("." + i.slideClass + ":not(." + i.slideDuplicateClass + ')[data-swiper-slide-index="' + l.attr("data-swiper-slide-index") + '"]').addClass(i.slideDuplicatePrevClass) : s.children("." + i.slideClass + "." + i.slideDuplicateClass + '[data-swiper-slide-index="' + l.attr("data-swiper-slide-index") + '"]').addClass(i.slideDuplicatePrevClass))
    },
    updateActiveIndex: function (e) {
      var t, i = this.rtlTranslate ? this.translate : -this.translate,
        s = this.slidesGrid,
        a = this.snapGrid,
        r = this.params,
        o = this.activeIndex,
        l = this.realIndex,
        d = this.snapIndex,
        h = e;
      if (void 0 === h) {
        for (var p = 0; p < s.length; p += 1) void 0 !== s[p + 1] ? i >= s[p] && i < s[p + 1] - (s[p + 1] - s[p]) / 2 ? h = p : i >= s[p] && i < s[p + 1] && (h = p + 1) : i >= s[p] && (h = p);
        r.normalizeSlideIndex && (h < 0 || void 0 === h) && (h = 0)
      }
      if (a.indexOf(i) >= 0) t = a.indexOf(i);
      else {
        var c = Math.min(r.slidesPerGroupSkip, h);
        t = c + Math.floor((h - c) / r.slidesPerGroup)
      }
      if (t >= a.length && (t = a.length - 1), h !== o) {
        var u = parseInt(this.slides.eq(h).attr("data-swiper-slide-index") || h, 10);
        n.extend(this, {
          snapIndex: t,
          realIndex: u,
          previousIndex: o,
          activeIndex: h
        }), this.emit("activeIndexChange"), this.emit("snapIndexChange"), l !== u && this.emit("realIndexChange"), (this.initialized || this.runCallbacksOnInit) && this.emit("slideChange")
      } else t !== d && (this.snapIndex = t, this.emit("snapIndexChange"))
    },
    updateClickedSlide: function (e) {
      var t = this.params,
        i = s(e.target).closest("." + t.slideClass)[0],
        a = !1;
      if (i)
        for (var r = 0; r < this.slides.length; r += 1) this.slides[r] === i && (a = !0);
      if (!i || !a) return this.clickedSlide = void 0, void (this.clickedIndex = void 0);
      this.clickedSlide = i, this.virtual && this.params.virtual.enabled ? this.clickedIndex = parseInt(s(i).attr("data-swiper-slide-index"), 10) : this.clickedIndex = s(i).index(), t.slideToClickedSlide && void 0 !== this.clickedIndex && this.clickedIndex !== this.activeIndex && this.slideToClickedSlide()
    }
  };
  var p = {
    getTranslate: function (e) {
      void 0 === e && (e = this.isHorizontal() ? "x" : "y");
      var t = this.params,
        i = this.rtlTranslate,
        s = this.translate,
        a = this.$wrapperEl;
      if (t.virtualTranslate) return i ? -s : s;
      if (t.cssMode) return s;
      var r = n.getTranslate(a[0], e);
      return i && (r = -r), r || 0
    },
    setTranslate: function (e, t) {
      var i = this.rtlTranslate,
        s = this.params,
        a = this.$wrapperEl,
        r = this.wrapperEl,
        n = this.progress,
        o = 0,
        l = 0;
      this.isHorizontal() ? o = i ? -e : e : l = e, s.roundLengths && (o = Math.floor(o), l = Math.floor(l)), s.cssMode ? r[this.isHorizontal() ? "scrollLeft" : "scrollTop"] = this.isHorizontal() ? -o : -l : s.virtualTranslate || a.transform("translate3d(" + o + "px, " + l + "px, 0px)"), this.previousTranslate = this.translate, this.translate = this.isHorizontal() ? o : l;
      var d = this.maxTranslate() - this.minTranslate();
      (0 === d ? 0 : (e - this.minTranslate()) / d) !== n && this.updateProgress(e), this.emit("setTranslate", this.translate, t)
    },
    minTranslate: function () {
      return -this.snapGrid[0]
    },
    maxTranslate: function () {
      return -this.snapGrid[this.snapGrid.length - 1]
    },
    translateTo: function (e, t, i, s, a) {
      var r;
      void 0 === e && (e = 0), void 0 === t && (t = this.params.speed), void 0 === i && (i = !0), void 0 === s && (s = !0);
      var n = this,
        o = n.params,
        l = n.wrapperEl;
      if (n.animating && o.preventInteractionOnTransition) return !1;
      var d, h = n.minTranslate(),
        p = n.maxTranslate();
      if (d = s && e > h ? h : s && e < p ? p : e, n.updateProgress(d), o.cssMode) {
        var c = n.isHorizontal();
        return 0 === t ? l[c ? "scrollLeft" : "scrollTop"] = -d : l.scrollTo ? l.scrollTo(((r = {})[c ? "left" : "top"] = -d, r.behavior = "smooth", r)) : l[c ? "scrollLeft" : "scrollTop"] = -d, !0
      }
      return 0 === t ? (n.setTransition(0), n.setTranslate(d), i && (n.emit("beforeTransitionStart", t, a), n.emit("transitionEnd"))) : (n.setTransition(t), n.setTranslate(d), i && (n.emit("beforeTransitionStart", t, a), n.emit("transitionStart")), n.animating || (n.animating = !0, n.onTranslateToWrapperTransitionEnd || (n.onTranslateToWrapperTransitionEnd = function (e) {
        n && !n.destroyed && e.target === this && (n.$wrapperEl[0].removeEventListener("transitionend", n.onTranslateToWrapperTransitionEnd), n.$wrapperEl[0].removeEventListener("webkitTransitionEnd", n.onTranslateToWrapperTransitionEnd), n.onTranslateToWrapperTransitionEnd = null, delete n.onTranslateToWrapperTransitionEnd, i && n.emit("transitionEnd"))
      }), n.$wrapperEl[0].addEventListener("transitionend", n.onTranslateToWrapperTransitionEnd), n.$wrapperEl[0].addEventListener("webkitTransitionEnd", n.onTranslateToWrapperTransitionEnd))), !0
    }
  };
  var c = {
    setTransition: function (e, t) {
      this.params.cssMode || this.$wrapperEl.transition(e), this.emit("setTransition", e, t)
    },
    transitionStart: function (e, t) {
      void 0 === e && (e = !0);
      var i = this.activeIndex,
        s = this.params,
        a = this.previousIndex;
      if (!s.cssMode) {
        s.autoHeight && this.updateAutoHeight();
        var r = t;
        if (r || (r = i > a ? "next" : i < a ? "prev" : "reset"), this.emit("transitionStart"), e && i !== a) {
          if ("reset" === r) return void this.emit("slideResetTransitionStart");
          this.emit("slideChangeTransitionStart"), "next" === r ? this.emit("slideNextTransitionStart") : this.emit("slidePrevTransitionStart")
        }
      }
    },
    transitionEnd: function (e, t) {
      void 0 === e && (e = !0);
      var i = this.activeIndex,
        s = this.previousIndex,
        a = this.params;
      if (this.animating = !1, !a.cssMode) {
        this.setTransition(0);
        var r = t;
        if (r || (r = i > s ? "next" : i < s ? "prev" : "reset"), this.emit("transitionEnd"), e && i !== s) {
          if ("reset" === r) return void this.emit("slideResetTransitionEnd");
          this.emit("slideChangeTransitionEnd"), "next" === r ? this.emit("slideNextTransitionEnd") : this.emit("slidePrevTransitionEnd")
        }
      }
    }
  };
  var u = {
    slideTo: function (e, t, i, s) {
      var a;
      void 0 === e && (e = 0), void 0 === t && (t = this.params.speed), void 0 === i && (i = !0);
      var r = this,
        n = e;
      n < 0 && (n = 0);
      var o = r.params,
        l = r.snapGrid,
        d = r.slidesGrid,
        h = r.previousIndex,
        p = r.activeIndex,
        c = r.rtlTranslate,
        u = r.wrapperEl;
      if (r.animating && o.preventInteractionOnTransition) return !1;
      var v = Math.min(r.params.slidesPerGroupSkip, n),
        f = v + Math.floor((n - v) / r.params.slidesPerGroup);
      f >= l.length && (f = l.length - 1), (p || o.initialSlide || 0) === (h || 0) && i && r.emit("beforeSlideChangeStart");
      var m, g = -l[f];
      if (r.updateProgress(g), o.normalizeSlideIndex)
        for (var b = 0; b < d.length; b += 1) - Math.floor(100 * g) >= Math.floor(100 * d[b]) && (n = b);
      if (r.initialized && n !== p) {
        if (!r.allowSlideNext && g < r.translate && g < r.minTranslate()) return !1;
        if (!r.allowSlidePrev && g > r.translate && g > r.maxTranslate() && (p || 0) !== n) return !1
      }
      if (m = n > p ? "next" : n < p ? "prev" : "reset", c && -g === r.translate || !c && g === r.translate) return r.updateActiveIndex(n), o.autoHeight && r.updateAutoHeight(), r.updateSlidesClasses(), "slide" !== o.effect && r.setTranslate(g), "reset" !== m && (r.transitionStart(i, m), r.transitionEnd(i, m)), !1;
      if (o.cssMode) {
        var w = r.isHorizontal();
        return 0 === t ? u[w ? "scrollLeft" : "scrollTop"] = -g : u.scrollTo ? u.scrollTo(((a = {})[w ? "left" : "top"] = -g, a.behavior = "smooth", a)) : u[w ? "scrollLeft" : "scrollTop"] = -g, !0
      }
      return 0 === t ? (r.setTransition(0), r.setTranslate(g), r.updateActiveIndex(n), r.updateSlidesClasses(), r.emit("beforeTransitionStart", t, s), r.transitionStart(i, m), r.transitionEnd(i, m)) : (r.setTransition(t), r.setTranslate(g), r.updateActiveIndex(n), r.updateSlidesClasses(), r.emit("beforeTransitionStart", t, s), r.transitionStart(i, m), r.animating || (r.animating = !0, r.onSlideToWrapperTransitionEnd || (r.onSlideToWrapperTransitionEnd = function (e) {
        r && !r.destroyed && e.target === this && (r.$wrapperEl[0].removeEventListener("transitionend", r.onSlideToWrapperTransitionEnd), r.$wrapperEl[0].removeEventListener("webkitTransitionEnd", r.onSlideToWrapperTransitionEnd), r.onSlideToWrapperTransitionEnd = null, delete r.onSlideToWrapperTransitionEnd, r.transitionEnd(i, m))
      }), r.$wrapperEl[0].addEventListener("transitionend", r.onSlideToWrapperTransitionEnd), r.$wrapperEl[0].addEventListener("webkitTransitionEnd", r.onSlideToWrapperTransitionEnd))), !0
    },
    slideToLoop: function (e, t, i, s) {
      void 0 === e && (e = 0), void 0 === t && (t = this.params.speed), void 0 === i && (i = !0);
      var a = e;
      return this.params.loop && (a += this.loopedSlides), this.slideTo(a, t, i, s)
    },
    slideNext: function (e, t, i) {
      void 0 === e && (e = this.params.speed), void 0 === t && (t = !0);
      var s = this.params,
        a = this.animating,
        r = this.activeIndex < s.slidesPerGroupSkip ? 1 : s.slidesPerGroup;
      if (s.loop) {
        if (a) return !1;
        this.loopFix(), this._clientLeft = this.$wrapperEl[0].clientLeft
      }
      return this.slideTo(this.activeIndex + r, e, t, i)
    },
    slidePrev: function (e, t, i) {
      void 0 === e && (e = this.params.speed), void 0 === t && (t = !0);
      var s = this.params,
        a = this.animating,
        r = this.snapGrid,
        n = this.slidesGrid,
        o = this.rtlTranslate;
      if (s.loop) {
        if (a) return !1;
        this.loopFix(), this._clientLeft = this.$wrapperEl[0].clientLeft
      }

      function l(e) {
        return e < 0 ? -Math.floor(Math.abs(e)) : Math.floor(e)
      }
      var d, h = l(o ? this.translate : -this.translate),
        p = r.map((function (e) {
          return l(e)
        })),
        c = (n.map((function (e) {
          return l(e)
        })), r[p.indexOf(h)], r[p.indexOf(h) - 1]);
      return void 0 === c && s.cssMode && r.forEach((function (e) {
        !c && h >= e && (c = e)
      })), void 0 !== c && (d = n.indexOf(c)) < 0 && (d = this.activeIndex - 1), this.slideTo(d, e, t, i)
    },
    slideReset: function (e, t, i) {
      return void 0 === e && (e = this.params.speed), void 0 === t && (t = !0), this.slideTo(this.activeIndex, e, t, i)
    },
    slideToClosest: function (e, t, i, s) {
      void 0 === e && (e = this.params.speed), void 0 === t && (t = !0), void 0 === s && (s = .5);
      var a = this.activeIndex,
        r = Math.min(this.params.slidesPerGroupSkip, a),
        n = r + Math.floor((a - r) / this.params.slidesPerGroup),
        o = this.rtlTranslate ? this.translate : -this.translate;
      if (o >= this.snapGrid[n]) {
        var l = this.snapGrid[n];
        o - l > (this.snapGrid[n + 1] - l) * s && (a += this.params.slidesPerGroup)
      } else {
        var d = this.snapGrid[n - 1];
        o - d <= (this.snapGrid[n] - d) * s && (a -= this.params.slidesPerGroup)
      }
      return a = Math.max(a, 0), a = Math.min(a, this.slidesGrid.length - 1), this.slideTo(a, e, t, i)
    },
    slideToClickedSlide: function () {
      var e, t = this,
        i = t.params,
        a = t.$wrapperEl,
        r = "auto" === i.slidesPerView ? t.slidesPerViewDynamic() : i.slidesPerView,
        o = t.clickedIndex;
      if (i.loop) {
        if (t.animating) return;
        e = parseInt(s(t.clickedSlide).attr("data-swiper-slide-index"), 10), i.centeredSlides ? o < t.loopedSlides - r / 2 || o > t.slides.length - t.loopedSlides + r / 2 ? (t.loopFix(), o = a.children("." + i.slideClass + '[data-swiper-slide-index="' + e + '"]:not(.' + i.slideDuplicateClass + ")").eq(0).index(), n.nextTick((function () {
          t.slideTo(o)
        }))) : t.slideTo(o) : o > t.slides.length - r ? (t.loopFix(), o = a.children("." + i.slideClass + '[data-swiper-slide-index="' + e + '"]:not(.' + i.slideDuplicateClass + ")").eq(0).index(), n.nextTick((function () {
          t.slideTo(o)
        }))) : t.slideTo(o)
      } else t.slideTo(o)
    }
  };
  var v = {
    loopCreate: function () {
      var t = this,
        i = t.params,
        a = t.$wrapperEl;
      a.children("." + i.slideClass + "." + i.slideDuplicateClass).remove();
      var r = a.children("." + i.slideClass);
      if (i.loopFillGroupWithBlank) {
        var n = i.slidesPerGroup - r.length % i.slidesPerGroup;
        if (n !== i.slidesPerGroup) {
          for (var o = 0; o < n; o += 1) {
            var l = s(e.createElement("div")).addClass(i.slideClass + " " + i.slideBlankClass);
            a.append(l)
          }
          r = a.children("." + i.slideClass)
        }
      }
      "auto" !== i.slidesPerView || i.loopedSlides || (i.loopedSlides = r.length), t.loopedSlides = Math.ceil(parseFloat(i.loopedSlides || i.slidesPerView, 10)), t.loopedSlides += i.loopAdditionalSlides, t.loopedSlides > r.length && (t.loopedSlides = r.length);
      var d = [],
        h = [];
      r.each((function (e, i) {
        var a = s(i);
        e < t.loopedSlides && h.push(i), e < r.length && e >= r.length - t.loopedSlides && d.push(i), a.attr("data-swiper-slide-index", e)
      }));
      for (var p = 0; p < h.length; p += 1) a.append(s(h[p].cloneNode(!0)).addClass(i.slideDuplicateClass));
      for (var c = d.length - 1; c >= 0; c -= 1) a.prepend(s(d[c].cloneNode(!0)).addClass(i.slideDuplicateClass))
    },
    loopFix: function () {
      this.emit("beforeLoopFix");
      var e, t = this.activeIndex,
        i = this.slides,
        s = this.loopedSlides,
        a = this.allowSlidePrev,
        r = this.allowSlideNext,
        n = this.snapGrid,
        o = this.rtlTranslate;
      this.allowSlidePrev = !0, this.allowSlideNext = !0;
      var l = -n[t] - this.getTranslate();
      if (t < s) e = i.length - 3 * s + t, e += s, this.slideTo(e, 0, !1, !0) && 0 !== l && this.setTranslate((o ? -this.translate : this.translate) - l);
      else if (t >= i.length - s) {
        e = -i.length + t + s, e += s, this.slideTo(e, 0, !1, !0) && 0 !== l && this.setTranslate((o ? -this.translate : this.translate) - l)
      }
      this.allowSlidePrev = a, this.allowSlideNext = r, this.emit("loopFix")
    },
    loopDestroy: function () {
      var e = this.$wrapperEl,
        t = this.params,
        i = this.slides;
      e.children("." + t.slideClass + "." + t.slideDuplicateClass + ",." + t.slideClass + "." + t.slideBlankClass).remove(), i.removeAttr("data-swiper-slide-index")
    }
  };
  var f = {
    setGrabCursor: function (e) {
      if (!(o.touch || !this.params.simulateTouch || this.params.watchOverflow && this.isLocked || this.params.cssMode)) {
        var t = this.el;
        t.style.cursor = "move", t.style.cursor = e ? "-webkit-grabbing" : "-webkit-grab", t.style.cursor = e ? "-moz-grabbin" : "-moz-grab", t.style.cursor = e ? "grabbing" : "grab"
      }
    },
    unsetGrabCursor: function () {
      o.touch || this.params.watchOverflow && this.isLocked || this.params.cssMode || (this.el.style.cursor = "")
    }
  };
  var m, g, b, w, y, x, T, E, S, C, M, P, z, k, $, L = {
    appendSlide: function (e) {
      var t = this.$wrapperEl,
        i = this.params;
      if (i.loop && this.loopDestroy(), "object" == typeof e && "length" in e)
        for (var s = 0; s < e.length; s += 1) e[s] && t.append(e[s]);
      else t.append(e);
      i.loop && this.loopCreate(), i.observer && o.observer || this.update()
    },
    prependSlide: function (e) {
      var t = this.params,
        i = this.$wrapperEl,
        s = this.activeIndex;
      t.loop && this.loopDestroy();
      var a = s + 1;
      if ("object" == typeof e && "length" in e) {
        for (var r = 0; r < e.length; r += 1) e[r] && i.prepend(e[r]);
        a = s + e.length
      } else i.prepend(e);
      t.loop && this.loopCreate(), t.observer && o.observer || this.update(), this.slideTo(a, 0, !1)
    },
    addSlide: function (e, t) {
      var i = this.$wrapperEl,
        s = this.params,
        a = this.activeIndex;
      s.loop && (a -= this.loopedSlides, this.loopDestroy(), this.slides = i.children("." + s.slideClass));
      var r = this.slides.length;
      if (e <= 0) this.prependSlide(t);
      else if (e >= r) this.appendSlide(t);
      else {
        for (var n = a > e ? a + 1 : a, l = [], d = r - 1; d >= e; d -= 1) {
          var h = this.slides.eq(d);
          h.remove(), l.unshift(h)
        }
        if ("object" == typeof t && "length" in t) {
          for (var p = 0; p < t.length; p += 1) t[p] && i.append(t[p]);
          n = a > e ? a + t.length : a
        } else i.append(t);
        for (var c = 0; c < l.length; c += 1) i.append(l[c]);
        s.loop && this.loopCreate(), s.observer && o.observer || this.update(), s.loop ? this.slideTo(n + this.loopedSlides, 0, !1) : this.slideTo(n, 0, !1)
      }
    },
    removeSlide: function (e) {
      var t = this.params,
        i = this.$wrapperEl,
        s = this.activeIndex;
      t.loop && (s -= this.loopedSlides, this.loopDestroy(), this.slides = i.children("." + t.slideClass));
      var a, r = s;
      if ("object" == typeof e && "length" in e) {
        for (var n = 0; n < e.length; n += 1) a = e[n], this.slides[a] && this.slides.eq(a).remove(), a < r && (r -= 1);
        r = Math.max(r, 0)
      } else a = e, this.slides[a] && this.slides.eq(a).remove(), a < r && (r -= 1), r = Math.max(r, 0);
      t.loop && this.loopCreate(), t.observer && o.observer || this.update(), t.loop ? this.slideTo(r + this.loopedSlides, 0, !1) : this.slideTo(r, 0, !1)
    },
    removeAllSlides: function () {
      for (var e = [], t = 0; t < this.slides.length; t += 1) e.push(t);
      this.removeSlide(e)
    }
  },
    I = (m = t.navigator.platform, g = t.navigator.userAgent, b = {
      ios: !1,
      android: !1,
      androidChrome: !1,
      desktop: !1,
      iphone: !1,
      ipod: !1,
      ipad: !1,
      edge: !1,
      ie: !1,
      firefox: !1,
      macos: !1,
      windows: !1,
      cordova: !(!t.cordova && !t.phonegap),
      phonegap: !(!t.cordova && !t.phonegap),
      electron: !1
    }, w = t.screen.width, y = t.screen.height, x = g.match(/(Android);?[\s\/]+([\d.]+)?/), T = g.match(/(iPad).*OS\s([\d_]+)/), E = g.match(/(iPod)(.*OS\s([\d_]+))?/), S = !T && g.match(/(iPhone\sOS|iOS)\s([\d_]+)/), C = g.indexOf("MSIE ") >= 0 || g.indexOf("Trident/") >= 0, M = g.indexOf("Edge/") >= 0, P = g.indexOf("Gecko/") >= 0 && g.indexOf("Firefox/") >= 0, z = "Win32" === m, k = g.toLowerCase().indexOf("electron") >= 0, $ = "MacIntel" === m, !T && $ && o.touch && (1024 === w && 1366 === y || 834 === w && 1194 === y || 834 === w && 1112 === y || 768 === w && 1024 === y) && (T = g.match(/(Version)\/([\d.]+)/), $ = !1), b.ie = C, b.edge = M, b.firefox = P, x && !z && (b.os = "android", b.osVersion = x[2], b.android = !0, b.androidChrome = g.toLowerCase().indexOf("chrome") >= 0), (T || S || E) && (b.os = "ios", b.ios = !0), S && !E && (b.osVersion = S[2].replace(/_/g, "."), b.iphone = !0), T && (b.osVersion = T[2].replace(/_/g, "."), b.ipad = !0), E && (b.osVersion = E[3] ? E[3].replace(/_/g, ".") : null, b.ipod = !0), b.ios && b.osVersion && g.indexOf("Version/") >= 0 && "10" === b.osVersion.split(".")[0] && (b.osVersion = g.toLowerCase().split("version/")[1].split(" ")[0]), b.webView = !(!(S || T || E) || !g.match(/.*AppleWebKit(?!.*Safari)/i) && !t.navigator.standalone) || t.matchMedia && t.matchMedia("(display-mode: standalone)").matches, b.webview = b.webView, b.standalone = b.webView, b.desktop = !(b.ios || b.android) || k, b.desktop && (b.electron = k, b.macos = $, b.windows = z, b.macos && (b.os = "macos"), b.windows && (b.os = "windows")), b.pixelRatio = t.devicePixelRatio || 1, b);

  function D(i) {
    var a = this.touchEventsData,
      r = this.params,
      o = this.touches;
    if (!this.animating || !r.preventInteractionOnTransition) {
      var l = i;
      l.originalEvent && (l = l.originalEvent);
      var d = s(l.target);
      if (("wrapper" !== r.touchEventsTarget || d.closest(this.wrapperEl).length) && (a.isTouchEvent = "touchstart" === l.type, (a.isTouchEvent || !("which" in l) || 3 !== l.which) && !(!a.isTouchEvent && "button" in l && l.button > 0 || a.isTouched && a.isMoved)))
        if (r.noSwiping && d.closest(r.noSwipingSelector ? r.noSwipingSelector : "." + r.noSwipingClass)[0]) this.allowClick = !0;
        else if (!r.swipeHandler || d.closest(r.swipeHandler)[0]) {
          o.currentX = "touchstart" === l.type ? l.targetTouches[0].pageX : l.pageX, o.currentY = "touchstart" === l.type ? l.targetTouches[0].pageY : l.pageY;
          var h = o.currentX,
            p = o.currentY,
            c = r.edgeSwipeDetection || r.iOSEdgeSwipeDetection,
            u = r.edgeSwipeThreshold || r.iOSEdgeSwipeThreshold;
          if (!c || !(h <= u || h >= t.screen.width - u)) {
            if (n.extend(a, {
              isTouched: !0,
              isMoved: !1,
              allowTouchCallbacks: !0,
              isScrolling: void 0,
              startMoving: void 0
            }), o.startX = h, o.startY = p, a.touchStartTime = n.now(), this.allowClick = !0, this.updateSize(), this.swipeDirection = void 0, r.threshold > 0 && (a.allowThresholdMove = !1), "touchstart" !== l.type) {
              var v = !0;
              d.is(a.formElements) && (v = !1), e.activeElement && s(e.activeElement).is(a.formElements) && e.activeElement !== d[0] && e.activeElement.blur();
              var f = v && this.allowTouchMove && r.touchStartPreventDefault;
              (r.touchStartForcePreventDefault || f) && l.preventDefault()
            }
            this.emit("touchStart", l)
          }
        }
    }
  }

  function O(t) {
    var i = this.touchEventsData,
      a = this.params,
      r = this.touches,
      o = this.rtlTranslate,
      l = t;
    if (l.originalEvent && (l = l.originalEvent), i.isTouched) {
      if (!i.isTouchEvent || "mousemove" !== l.type) {
        var d = "touchmove" === l.type && l.targetTouches && (l.targetTouches[0] || l.changedTouches[0]),
          h = "touchmove" === l.type ? d.pageX : l.pageX,
          p = "touchmove" === l.type ? d.pageY : l.pageY;
        if (l.preventedByNestedSwiper) return r.startX = h, void (r.startY = p);
        if (!this.allowTouchMove) return this.allowClick = !1, void (i.isTouched && (n.extend(r, {
          startX: h,
          startY: p,
          currentX: h,
          currentY: p
        }), i.touchStartTime = n.now()));
        if (i.isTouchEvent && a.touchReleaseOnEdges && !a.loop)
          if (this.isVertical()) {
            if (p < r.startY && this.translate <= this.maxTranslate() || p > r.startY && this.translate >= this.minTranslate()) return i.isTouched = !1, void (i.isMoved = !1)
          } else if (h < r.startX && this.translate <= this.maxTranslate() || h > r.startX && this.translate >= this.minTranslate()) return;
        if (i.isTouchEvent && e.activeElement && l.target === e.activeElement && s(l.target).is(i.formElements)) return i.isMoved = !0, void (this.allowClick = !1);
        if (i.allowTouchCallbacks && this.emit("touchMove", l), !(l.targetTouches && l.targetTouches.length > 1)) {
          r.currentX = h, r.currentY = p;
          var c = r.currentX - r.startX,
            u = r.currentY - r.startY;
          if (!(this.params.threshold && Math.sqrt(Math.pow(c, 2) + Math.pow(u, 2)) < this.params.threshold)) {
            var v;
            if (void 0 === i.isScrolling) this.isHorizontal() && r.currentY === r.startY || this.isVertical() && r.currentX === r.startX ? i.isScrolling = !1 : c * c + u * u >= 25 && (v = 180 * Math.atan2(Math.abs(u), Math.abs(c)) / Math.PI, i.isScrolling = this.isHorizontal() ? v > a.touchAngle : 90 - v > a.touchAngle);
            if (i.isScrolling && this.emit("touchMoveOpposite", l), void 0 === i.startMoving && (r.currentX === r.startX && r.currentY === r.startY || (i.startMoving = !0)), i.isScrolling) i.isTouched = !1;
            else if (i.startMoving) {
              this.allowClick = !1, a.cssMode || l.preventDefault(), a.touchMoveStopPropagation && !a.nested && l.stopPropagation(), i.isMoved || (a.loop && this.loopFix(), i.startTranslate = this.getTranslate(), this.setTransition(0), this.animating && this.$wrapperEl.trigger("webkitTransitionEnd transitionend"), i.allowMomentumBounce = !1, !a.grabCursor || !0 !== this.allowSlideNext && !0 !== this.allowSlidePrev || this.setGrabCursor(!0), this.emit("sliderFirstMove", l)), this.emit("sliderMove", l), i.isMoved = !0;
              var f = this.isHorizontal() ? c : u;
              r.diff = f, f *= a.touchRatio, o && (f = -f), this.swipeDirection = f > 0 ? "prev" : "next", i.currentTranslate = f + i.startTranslate;
              var m = !0,
                g = a.resistanceRatio;
              if (a.touchReleaseOnEdges && (g = 0), f > 0 && i.currentTranslate > this.minTranslate() ? (m = !1, a.resistance && (i.currentTranslate = this.minTranslate() - 1 + Math.pow(-this.minTranslate() + i.startTranslate + f, g))) : f < 0 && i.currentTranslate < this.maxTranslate() && (m = !1, a.resistance && (i.currentTranslate = this.maxTranslate() + 1 - Math.pow(this.maxTranslate() - i.startTranslate - f, g))), m && (l.preventedByNestedSwiper = !0), !this.allowSlideNext && "next" === this.swipeDirection && i.currentTranslate < i.startTranslate && (i.currentTranslate = i.startTranslate), !this.allowSlidePrev && "prev" === this.swipeDirection && i.currentTranslate > i.startTranslate && (i.currentTranslate = i.startTranslate), a.threshold > 0) {
                if (!(Math.abs(f) > a.threshold || i.allowThresholdMove)) return void (i.currentTranslate = i.startTranslate);
                if (!i.allowThresholdMove) return i.allowThresholdMove = !0, r.startX = r.currentX, r.startY = r.currentY, i.currentTranslate = i.startTranslate, void (r.diff = this.isHorizontal() ? r.currentX - r.startX : r.currentY - r.startY)
              }
              a.followFinger && !a.cssMode && ((a.freeMode || a.watchSlidesProgress || a.watchSlidesVisibility) && (this.updateActiveIndex(), this.updateSlidesClasses()), a.freeMode && (0 === i.velocities.length && i.velocities.push({
                position: r[this.isHorizontal() ? "startX" : "startY"],
                time: i.touchStartTime
              }), i.velocities.push({
                position: r[this.isHorizontal() ? "currentX" : "currentY"],
                time: n.now()
              })), this.updateProgress(i.currentTranslate), this.setTranslate(i.currentTranslate))
            }
          }
        }
      }
    } else i.startMoving && i.isScrolling && this.emit("touchMoveOpposite", l)
  }

  function A(e) {
    var t = this,
      i = t.touchEventsData,
      s = t.params,
      a = t.touches,
      r = t.rtlTranslate,
      o = t.$wrapperEl,
      l = t.slidesGrid,
      d = t.snapGrid,
      h = e;
    if (h.originalEvent && (h = h.originalEvent), i.allowTouchCallbacks && t.emit("touchEnd", h), i.allowTouchCallbacks = !1, !i.isTouched) return i.isMoved && s.grabCursor && t.setGrabCursor(!1), i.isMoved = !1, void (i.startMoving = !1);
    s.grabCursor && i.isMoved && i.isTouched && (!0 === t.allowSlideNext || !0 === t.allowSlidePrev) && t.setGrabCursor(!1);
    var p, c = n.now(),
      u = c - i.touchStartTime;
    if (t.allowClick && (t.updateClickedSlide(h), t.emit("tap click", h), u < 300 && c - i.lastClickTime < 300 && t.emit("doubleTap doubleClick", h)), i.lastClickTime = n.now(), n.nextTick((function () {
      t.destroyed || (t.allowClick = !0)
    })), !i.isTouched || !i.isMoved || !t.swipeDirection || 0 === a.diff || i.currentTranslate === i.startTranslate) return i.isTouched = !1, i.isMoved = !1, void (i.startMoving = !1);
    if (i.isTouched = !1, i.isMoved = !1, i.startMoving = !1, p = s.followFinger ? r ? t.translate : -t.translate : -i.currentTranslate, !s.cssMode)
      if (s.freeMode) {
        if (p < -t.minTranslate()) return void t.slideTo(t.activeIndex);
        if (p > -t.maxTranslate()) return void (t.slides.length < d.length ? t.slideTo(d.length - 1) : t.slideTo(t.slides.length - 1));
        if (s.freeModeMomentum) {
          if (i.velocities.length > 1) {
            var v = i.velocities.pop(),
              f = i.velocities.pop(),
              m = v.position - f.position,
              g = v.time - f.time;
            t.velocity = m / g, t.velocity /= 2, Math.abs(t.velocity) < s.freeModeMinimumVelocity && (t.velocity = 0), (g > 150 || n.now() - v.time > 300) && (t.velocity = 0)
          } else t.velocity = 0;
          t.velocity *= s.freeModeMomentumVelocityRatio, i.velocities.length = 0;
          var b = 1e3 * s.freeModeMomentumRatio,
            w = t.velocity * b,
            y = t.translate + w;
          r && (y = -y);
          var x, T, E = !1,
            S = 20 * Math.abs(t.velocity) * s.freeModeMomentumBounceRatio;
          if (y < t.maxTranslate()) s.freeModeMomentumBounce ? (y + t.maxTranslate() < -S && (y = t.maxTranslate() - S), x = t.maxTranslate(), E = !0, i.allowMomentumBounce = !0) : y = t.maxTranslate(), s.loop && s.centeredSlides && (T = !0);
          else if (y > t.minTranslate()) s.freeModeMomentumBounce ? (y - t.minTranslate() > S && (y = t.minTranslate() + S), x = t.minTranslate(), E = !0, i.allowMomentumBounce = !0) : y = t.minTranslate(), s.loop && s.centeredSlides && (T = !0);
          else if (s.freeModeSticky) {
            for (var C, M = 0; M < d.length; M += 1)
              if (d[M] > -y) {
                C = M;
                break
              }
            y = -(y = Math.abs(d[C] - y) < Math.abs(d[C - 1] - y) || "next" === t.swipeDirection ? d[C] : d[C - 1])
          }
          if (T && t.once("transitionEnd", (function () {
            t.loopFix()
          })), 0 !== t.velocity) {
            if (b = r ? Math.abs((-y - t.translate) / t.velocity) : Math.abs((y - t.translate) / t.velocity), s.freeModeSticky) {
              var P = Math.abs((r ? -y : y) - t.translate),
                z = t.slidesSizesGrid[t.activeIndex];
              b = P < z ? s.speed : P < 2 * z ? 1.5 * s.speed : 2.5 * s.speed
            }
          } else if (s.freeModeSticky) return void t.slideToClosest();
          s.freeModeMomentumBounce && E ? (t.updateProgress(x), t.setTransition(b), t.setTranslate(y), t.transitionStart(!0, t.swipeDirection), t.animating = !0, o.transitionEnd((function () {
            t && !t.destroyed && i.allowMomentumBounce && (t.emit("momentumBounce"), t.setTransition(s.speed), t.setTranslate(x), o.transitionEnd((function () {
              t && !t.destroyed && t.transitionEnd()
            })))
          }))) : t.velocity ? (t.updateProgress(y), t.setTransition(b), t.setTranslate(y), t.transitionStart(!0, t.swipeDirection), t.animating || (t.animating = !0, o.transitionEnd((function () {
            t && !t.destroyed && t.transitionEnd()
          })))) : t.updateProgress(y), t.updateActiveIndex(), t.updateSlidesClasses()
        } else if (s.freeModeSticky) return void t.slideToClosest();
        (!s.freeModeMomentum || u >= s.longSwipesMs) && (t.updateProgress(), t.updateActiveIndex(), t.updateSlidesClasses())
      } else {
        for (var k = 0, $ = t.slidesSizesGrid[0], L = 0; L < l.length; L += L < s.slidesPerGroupSkip ? 1 : s.slidesPerGroup) {
          var I = L < s.slidesPerGroupSkip - 1 ? 1 : s.slidesPerGroup;
          void 0 !== l[L + I] ? p >= l[L] && p < l[L + I] && (k = L, $ = l[L + I] - l[L]) : p >= l[L] && (k = L, $ = l[l.length - 1] - l[l.length - 2])
        }
        var D = (p - l[k]) / $,
          O = k < s.slidesPerGroupSkip - 1 ? 1 : s.slidesPerGroup;
        if (u > s.longSwipesMs) {
          if (!s.longSwipes) return void t.slideTo(t.activeIndex);
          "next" === t.swipeDirection && (D >= s.longSwipesRatio ? t.slideTo(k + O) : t.slideTo(k)), "prev" === t.swipeDirection && (D > 1 - s.longSwipesRatio ? t.slideTo(k + O) : t.slideTo(k))
        } else {
          if (!s.shortSwipes) return void t.slideTo(t.activeIndex);
          t.navigation && (h.target === t.navigation.nextEl || h.target === t.navigation.prevEl) ? h.target === t.navigation.nextEl ? t.slideTo(k + O) : t.slideTo(k) : ("next" === t.swipeDirection && t.slideTo(k + O), "prev" === t.swipeDirection && t.slideTo(k))
        }
      }
  }

  function G() {
    var e = this.params,
      t = this.el;
    if (!t || 0 !== t.offsetWidth) {
      e.breakpoints && this.setBreakpoint();
      var i = this.allowSlideNext,
        s = this.allowSlidePrev,
        a = this.snapGrid;
      this.allowSlideNext = !0, this.allowSlidePrev = !0, this.updateSize(), this.updateSlides(), this.updateSlidesClasses(), ("auto" === e.slidesPerView || e.slidesPerView > 1) && this.isEnd && !this.params.centeredSlides ? this.slideTo(this.slides.length - 1, 0, !1, !0) : this.slideTo(this.activeIndex, 0, !1, !0), this.autoplay && this.autoplay.running && this.autoplay.paused && this.autoplay.run(), this.allowSlidePrev = s, this.allowSlideNext = i, this.params.watchOverflow && a !== this.snapGrid && this.checkOverflow()
    }
  }

  function H(e) {
    this.allowClick || (this.params.preventClicks && e.preventDefault(), this.params.preventClicksPropagation && this.animating && (e.stopPropagation(), e.stopImmediatePropagation()))
  }

  function B() {
    var e = this.wrapperEl;
    this.previousTranslate = this.translate, this.translate = this.isHorizontal() ? -e.scrollLeft : -e.scrollTop, -0 === this.translate && (this.translate = 0), this.updateActiveIndex(), this.updateSlidesClasses();
    var t = this.maxTranslate() - this.minTranslate();
    (0 === t ? 0 : (this.translate - this.minTranslate()) / t) !== this.progress && this.updateProgress(this.translate), this.emit("setTranslate", this.translate, !1)
  }
  var N = !1;

  function X() { }
  var V = {
    init: !0,
    direction: "horizontal",
    touchEventsTarget: "container",
    initialSlide: 0,
    speed: 300,
    cssMode: !1,
    updateOnWindowResize: !0,
    preventInteractionOnTransition: !1,
    edgeSwipeDetection: !1,
    edgeSwipeThreshold: 20,
    freeMode: !1,
    freeModeMomentum: !0,
    freeModeMomentumRatio: 1,
    freeModeMomentumBounce: !0,
    freeModeMomentumBounceRatio: 1,
    freeModeMomentumVelocityRatio: 1,
    freeModeSticky: !1,
    freeModeMinimumVelocity: .02,
    autoHeight: !1,
    setWrapperSize: !1,
    virtualTranslate: !1,
    effect: "slide",
    breakpoints: void 0,
    spaceBetween: 0,
    slidesPerView: 1,
    slidesPerColumn: 1,
    slidesPerColumnFill: "column",
    slidesPerGroup: 1,
    slidesPerGroupSkip: 0,
    centeredSlides: !1,
    centeredSlidesBounds: !1,
    slidesOffsetBefore: 0,
    slidesOffsetAfter: 0,
    normalizeSlideIndex: !0,
    centerInsufficientSlides: !1,
    watchOverflow: !1,
    roundLengths: !1,
    touchRatio: 1,
    touchAngle: 45,
    simulateTouch: !0,
    shortSwipes: !0,
    longSwipes: !0,
    longSwipesRatio: .5,
    longSwipesMs: 300,
    followFinger: !0,
    allowTouchMove: !0,
    threshold: 0,
    touchMoveStopPropagation: !1,
    touchStartPreventDefault: !0,
    touchStartForcePreventDefault: !1,
    touchReleaseOnEdges: !1,
    uniqueNavElements: !0,
    resistance: !0,
    resistanceRatio: .85,
    watchSlidesProgress: !1,
    watchSlidesVisibility: !1,
    grabCursor: !1,
    preventClicks: !0,
    preventClicksPropagation: !0,
    slideToClickedSlide: !1,
    preloadImages: !0,
    updateOnImagesReady: !0,
    loop: !1,
    loopAdditionalSlides: 0,
    loopedSlides: null,
    loopFillGroupWithBlank: !1,
    allowSlidePrev: !0,
    allowSlideNext: !0,
    swipeHandler: null,
    noSwiping: !0,
    noSwipingClass: "swiper-no-swiping",
    noSwipingSelector: null,
    passiveListeners: !0,
    containerModifierClass: "swiper-container-",
    slideClass: "swiper-slide",
    slideBlankClass: "swiper-slide-invisible-blank",
    slideActiveClass: "swiper-slide-active",
    slideDuplicateActiveClass: "swiper-slide-duplicate-active",
    slideVisibleClass: "swiper-slide-visible",
    slideDuplicateClass: "swiper-slide-duplicate",
    slideNextClass: "swiper-slide-next",
    slideDuplicateNextClass: "swiper-slide-duplicate-next",
    slidePrevClass: "swiper-slide-prev",
    slideDuplicatePrevClass: "swiper-slide-duplicate-prev",
    wrapperClass: "swiper-wrapper",
    runCallbacksOnInit: !0
  },
    Y = {
      update: h,
      translate: p,
      transition: c,
      slide: u,
      loop: v,
      grabCursor: f,
      manipulation: L,
      events: {
        attachEvents: function () {
          var t = this.params,
            i = this.touchEvents,
            s = this.el,
            a = this.wrapperEl;
          this.onTouchStart = D.bind(this), this.onTouchMove = O.bind(this), this.onTouchEnd = A.bind(this), t.cssMode && (this.onScroll = B.bind(this)), this.onClick = H.bind(this);
          var r = !!t.nested;
          if (!o.touch && o.pointerEvents) s.addEventListener(i.start, this.onTouchStart, !1), e.addEventListener(i.move, this.onTouchMove, r), e.addEventListener(i.end, this.onTouchEnd, !1);
          else {
            if (o.touch) {
              var n = !("touchstart" !== i.start || !o.passiveListener || !t.passiveListeners) && {
                passive: !0,
                capture: !1
              };
              s.addEventListener(i.start, this.onTouchStart, n), s.addEventListener(i.move, this.onTouchMove, o.passiveListener ? {
                passive: !1,
                capture: r
              } : r), s.addEventListener(i.end, this.onTouchEnd, n), i.cancel && s.addEventListener(i.cancel, this.onTouchEnd, n), N || (e.addEventListener("touchstart", X), N = !0)
            } (t.simulateTouch && !I.ios && !I.android || t.simulateTouch && !o.touch && I.ios) && (s.addEventListener("mousedown", this.onTouchStart, !1), e.addEventListener("mousemove", this.onTouchMove, r), e.addEventListener("mouseup", this.onTouchEnd, !1))
          } (t.preventClicks || t.preventClicksPropagation) && s.addEventListener("click", this.onClick, !0), t.cssMode && a.addEventListener("scroll", this.onScroll), t.updateOnWindowResize ? this.on(I.ios || I.android ? "resize orientationchange observerUpdate" : "resize observerUpdate", G, !0) : this.on("observerUpdate", G, !0)
        },
        detachEvents: function () {
          var t = this.params,
            i = this.touchEvents,
            s = this.el,
            a = this.wrapperEl,
            r = !!t.nested;
          if (!o.touch && o.pointerEvents) s.removeEventListener(i.start, this.onTouchStart, !1), e.removeEventListener(i.move, this.onTouchMove, r), e.removeEventListener(i.end, this.onTouchEnd, !1);
          else {
            if (o.touch) {
              var n = !("onTouchStart" !== i.start || !o.passiveListener || !t.passiveListeners) && {
                passive: !0,
                capture: !1
              };
              s.removeEventListener(i.start, this.onTouchStart, n), s.removeEventListener(i.move, this.onTouchMove, r), s.removeEventListener(i.end, this.onTouchEnd, n), i.cancel && s.removeEventListener(i.cancel, this.onTouchEnd, n)
            } (t.simulateTouch && !I.ios && !I.android || t.simulateTouch && !o.touch && I.ios) && (s.removeEventListener("mousedown", this.onTouchStart, !1), e.removeEventListener("mousemove", this.onTouchMove, r), e.removeEventListener("mouseup", this.onTouchEnd, !1))
          } (t.preventClicks || t.preventClicksPropagation) && s.removeEventListener("click", this.onClick, !0), t.cssMode && a.removeEventListener("scroll", this.onScroll), this.off(I.ios || I.android ? "resize orientationchange observerUpdate" : "resize observerUpdate", G)
        }
      },
      breakpoints: {
        setBreakpoint: function () {
          var e = this.activeIndex,
            t = this.initialized,
            i = this.loopedSlides;
          void 0 === i && (i = 0);
          var s = this.params,
            a = this.$el,
            r = s.breakpoints;
          if (r && (!r || 0 !== Object.keys(r).length)) {
            var o = this.getBreakpoint(r);
            if (o && this.currentBreakpoint !== o) {
              var l = o in r ? r[o] : void 0;
              l && ["slidesPerView", "spaceBetween", "slidesPerGroup", "slidesPerGroupSkip", "slidesPerColumn"].forEach((function (e) {
                var t = l[e];
                void 0 !== t && (l[e] = "slidesPerView" !== e || "AUTO" !== t && "auto" !== t ? "slidesPerView" === e ? parseFloat(t) : parseInt(t, 10) : "auto")
              }));
              var d = l || this.originalParams,
                h = s.slidesPerColumn > 1,
                p = d.slidesPerColumn > 1;
              h && !p ? a.removeClass(s.containerModifierClass + "multirow " + s.containerModifierClass + "multirow-column") : !h && p && (a.addClass(s.containerModifierClass + "multirow"), "column" === d.slidesPerColumnFill && a.addClass(s.containerModifierClass + "multirow-column"));
              var c = d.direction && d.direction !== s.direction,
                u = s.loop && (d.slidesPerView !== s.slidesPerView || c);
              c && t && this.changeDirection(), n.extend(this.params, d), n.extend(this, {
                allowTouchMove: this.params.allowTouchMove,
                allowSlideNext: this.params.allowSlideNext,
                allowSlidePrev: this.params.allowSlidePrev
              }), this.currentBreakpoint = o, u && t && (this.loopDestroy(), this.loopCreate(), this.updateSlides(), this.slideTo(e - i + this.loopedSlides, 0, !1)), this.emit("breakpoint", d)
            }
          }
        },
        getBreakpoint: function (e) {
          if (e) {
            var i = !1,
              s = Object.keys(e).map((function (e) {
                if ("string" == typeof e && 0 === e.indexOf("@")) {
                  var i = parseFloat(e.substr(1));
                  return {
                    value: t.innerHeight * i,
                    point: e
                  }
                }
                return {
                  value: e,
                  point: e
                }
              }));
            s.sort((function (e, t) {
              return parseInt(e.value, 10) - parseInt(t.value, 10)
            }));
            for (var a = 0; a < s.length; a += 1) {
              var r = s[a],
                n = r.point;
              r.value <= t.innerWidth && (i = n)
            }
            return i || "max"
          }
        }
      },
      checkOverflow: {
        checkOverflow: function () {
          var e = this.params,
            t = this.isLocked,
            i = this.slides.length > 0 && e.slidesOffsetBefore + e.spaceBetween * (this.slides.length - 1) + this.slides[0].offsetWidth * this.slides.length;
          e.slidesOffsetBefore && e.slidesOffsetAfter && i ? this.isLocked = i <= this.size : this.isLocked = 1 === this.snapGrid.length, this.allowSlideNext = !this.isLocked, this.allowSlidePrev = !this.isLocked, t !== this.isLocked && this.emit(this.isLocked ? "lock" : "unlock"), t && t !== this.isLocked && (this.isEnd = !1, this.navigation.update())
        }
      },
      classes: {
        addClasses: function () {
          var e = this.classNames,
            t = this.params,
            i = this.rtl,
            s = this.$el,
            a = [];
          a.push("initialized"), a.push(t.direction), t.freeMode && a.push("free-mode"), t.autoHeight && a.push("autoheight"), i && a.push("rtl"), t.slidesPerColumn > 1 && (a.push("multirow"), "column" === t.slidesPerColumnFill && a.push("multirow-column")), I.android && a.push("android"), I.ios && a.push("ios"), t.cssMode && a.push("css-mode"), a.forEach((function (i) {
            e.push(t.containerModifierClass + i)
          })), s.addClass(e.join(" "))
        },
        removeClasses: function () {
          var e = this.$el,
            t = this.classNames;
          e.removeClass(t.join(" "))
        }
      },
      images: {
        loadImage: function (e, i, s, a, r, n) {
          var o;

          function l() {
            n && n()
          }
          e.complete && r ? l() : i ? ((o = new t.Image).onload = l, o.onerror = l, a && (o.sizes = a), s && (o.srcset = s), i && (o.src = i)) : l()
        },
        preloadImages: function () {
          var e = this;

          function t() {
            null != e && e && !e.destroyed && (void 0 !== e.imagesLoaded && (e.imagesLoaded += 1), e.imagesLoaded === e.imagesToLoad.length && (e.params.updateOnImagesReady && e.update(), e.emit("imagesReady")))
          }
          e.imagesToLoad = e.$el.find("img");
          for (var i = 0; i < e.imagesToLoad.length; i += 1) {
            var s = e.imagesToLoad[i];
            e.loadImage(s, s.currentSrc || s.getAttribute("src"), s.srcset || s.getAttribute("srcset"), s.sizes || s.getAttribute("sizes"), !0, t)
          }
        }
      }
    },
    F = {},
    W = function (e) {
      function t() {
        for (var i, a, r, l = [], d = arguments.length; d--;) l[d] = arguments[d];
        1 === l.length && l[0].constructor && l[0].constructor === Object ? r = l[0] : (a = (i = l)[0], r = i[1]), r || (r = {}), r = n.extend({}, r), a && !r.el && (r.el = a), e.call(this, r), Object.keys(Y).forEach((function (e) {
          Object.keys(Y[e]).forEach((function (i) {
            t.prototype[i] || (t.prototype[i] = Y[e][i])
          }))
        }));
        var h = this;
        void 0 === h.modules && (h.modules = {}), Object.keys(h.modules).forEach((function (e) {
          var t = h.modules[e];
          if (t.params) {
            var i = Object.keys(t.params)[0],
              s = t.params[i];
            if ("object" != typeof s || null === s) return;
            if (!(i in r && "enabled" in s)) return;
            !0 === r[i] && (r[i] = {
              enabled: !0
            }), "object" != typeof r[i] || "enabled" in r[i] || (r[i].enabled = !0), r[i] || (r[i] = {
              enabled: !1
            })
          }
        }));
        var p = n.extend({}, V);
        h.useModulesParams(p), h.params = n.extend({}, p, F, r), h.originalParams = n.extend({}, h.params), h.passedParams = n.extend({}, r), h.$ = s;
        var c = s(h.params.el);
        if (a = c[0]) {
          if (c.length > 1) {
            var u = [];
            return c.each((function (e, i) {
              var s = n.extend({}, r, {
                el: i
              });
              u.push(new t(s))
            })), u
          }
          var v, f, m;
          return a.swiper = h, c.data("swiper", h), a && a.shadowRoot && a.shadowRoot.querySelector ? (v = s(a.shadowRoot.querySelector("." + h.params.wrapperClass))).children = function (e) {
            return c.children(e)
          } : v = c.children("." + h.params.wrapperClass), n.extend(h, {
            $el: c,
            el: a,
            $wrapperEl: v,
            wrapperEl: v[0],
            classNames: [],
            slides: s(),
            slidesGrid: [],
            snapGrid: [],
            slidesSizesGrid: [],
            isHorizontal: function () {
              return "horizontal" === h.params.direction
            },
            isVertical: function () {
              return "vertical" === h.params.direction
            },
            rtl: "rtl" === a.dir.toLowerCase() || "rtl" === c.css("direction"),
            rtlTranslate: "horizontal" === h.params.direction && ("rtl" === a.dir.toLowerCase() || "rtl" === c.css("direction")),
            wrongRTL: "-webkit-box" === v.css("display"),
            activeIndex: 0,
            realIndex: 0,
            isBeginning: !0,
            isEnd: !1,
            translate: 0,
            previousTranslate: 0,
            progress: 0,
            velocity: 0,
            animating: !1,
            allowSlideNext: h.params.allowSlideNext,
            allowSlidePrev: h.params.allowSlidePrev,
            touchEvents: (f = ["touchstart", "touchmove", "touchend", "touchcancel"], m = ["mousedown", "mousemove", "mouseup"], o.pointerEvents && (m = ["pointerdown", "pointermove", "pointerup"]), h.touchEventsTouch = {
              start: f[0],
              move: f[1],
              end: f[2],
              cancel: f[3]
            }, h.touchEventsDesktop = {
              start: m[0],
              move: m[1],
              end: m[2]
            }, o.touch || !h.params.simulateTouch ? h.touchEventsTouch : h.touchEventsDesktop),
            touchEventsData: {
              isTouched: void 0,
              isMoved: void 0,
              allowTouchCallbacks: void 0,
              touchStartTime: void 0,
              isScrolling: void 0,
              currentTranslate: void 0,
              startTranslate: void 0,
              allowThresholdMove: void 0,
              formElements: "input, select, option, textarea, button, video, label",
              lastClickTime: n.now(),
              clickTimeout: void 0,
              velocities: [],
              allowMomentumBounce: void 0,
              isTouchEvent: void 0,
              startMoving: void 0
            },
            allowClick: !0,
            allowTouchMove: h.params.allowTouchMove,
            touches: {
              startX: 0,
              startY: 0,
              currentX: 0,
              currentY: 0,
              diff: 0
            },
            imagesToLoad: [],
            imagesLoaded: 0
          }), h.useModules(), h.params.init && h.init(), h
        }
      }
      e && (t.__proto__ = e), t.prototype = Object.create(e && e.prototype), t.prototype.constructor = t;
      var i = {
        extendedDefaults: {
          configurable: !0
        },
        defaults: {
          configurable: !0
        },
        Class: {
          configurable: !0
        },
        $: {
          configurable: !0
        }
      };
      return t.prototype.slidesPerViewDynamic = function () {
        var e = this.params,
          t = this.slides,
          i = this.slidesGrid,
          s = this.size,
          a = this.activeIndex,
          r = 1;
        if (e.centeredSlides) {
          for (var n, o = t[a].swiperSlideSize, l = a + 1; l < t.length; l += 1) t[l] && !n && (r += 1, (o += t[l].swiperSlideSize) > s && (n = !0));
          for (var d = a - 1; d >= 0; d -= 1) t[d] && !n && (r += 1, (o += t[d].swiperSlideSize) > s && (n = !0))
        } else
          for (var h = a + 1; h < t.length; h += 1) i[h] - i[a] < s && (r += 1);
        return r
      }, t.prototype.update = function () {
        var e = this;
        if (e && !e.destroyed) {
          var t = e.snapGrid,
            i = e.params;
          i.breakpoints && e.setBreakpoint(), e.updateSize(), e.updateSlides(), e.updateProgress(), e.updateSlidesClasses(), e.params.freeMode ? (s(), e.params.autoHeight && e.updateAutoHeight()) : (("auto" === e.params.slidesPerView || e.params.slidesPerView > 1) && e.isEnd && !e.params.centeredSlides ? e.slideTo(e.slides.length - 1, 0, !1, !0) : e.slideTo(e.activeIndex, 0, !1, !0)) || s(), i.watchOverflow && t !== e.snapGrid && e.checkOverflow(), e.emit("update")
        }

        function s() {
          var t = e.rtlTranslate ? -1 * e.translate : e.translate,
            i = Math.min(Math.max(t, e.maxTranslate()), e.minTranslate());
          e.setTranslate(i), e.updateActiveIndex(), e.updateSlidesClasses()
        }
      }, t.prototype.changeDirection = function (e, t) {
        void 0 === t && (t = !0);
        var i = this.params.direction;
        return e || (e = "horizontal" === i ? "vertical" : "horizontal"), e === i || "horizontal" !== e && "vertical" !== e ? this : (this.$el.removeClass("" + this.params.containerModifierClass + i).addClass("" + this.params.containerModifierClass + e), this.params.direction = e, this.slides.each((function (t, i) {
          "vertical" === e ? i.style.width = "" : i.style.height = ""
        })), this.emit("changeDirection"), t && this.update(), this)
      }, t.prototype.init = function () {
        this.initialized || (this.emit("beforeInit"), this.params.breakpoints && this.setBreakpoint(), this.addClasses(), this.params.loop && this.loopCreate(), this.updateSize(), this.updateSlides(), this.params.watchOverflow && this.checkOverflow(), this.params.grabCursor && this.setGrabCursor(), this.params.preloadImages && this.preloadImages(), this.params.loop ? this.slideTo(this.params.initialSlide + this.loopedSlides, 0, this.params.runCallbacksOnInit) : this.slideTo(this.params.initialSlide, 0, this.params.runCallbacksOnInit), this.attachEvents(), this.initialized = !0, this.emit("init"))
      }, t.prototype.destroy = function (e, t) {
        void 0 === e && (e = !0), void 0 === t && (t = !0);
        var i = this,
          s = i.params,
          a = i.$el,
          r = i.$wrapperEl,
          o = i.slides;
        return void 0 === i.params || i.destroyed ? null : (i.emit("beforeDestroy"), i.initialized = !1, i.detachEvents(), s.loop && i.loopDestroy(), t && (i.removeClasses(), a.removeAttr("style"), r.removeAttr("style"), o && o.length && o.removeClass([s.slideVisibleClass, s.slideActiveClass, s.slideNextClass, s.slidePrevClass].join(" ")).removeAttr("style").removeAttr("data-swiper-slide-index")), i.emit("destroy"), Object.keys(i.eventsListeners).forEach((function (e) {
          i.off(e)
        })), !1 !== e && (i.$el[0].swiper = null, i.$el.data("swiper", null), n.deleteProps(i)), i.destroyed = !0, null)
      }, t.extendDefaults = function (e) {
        n.extend(F, e)
      }, i.extendedDefaults.get = function () {
        return F
      }, i.defaults.get = function () {
        return V
      }, i.Class.get = function () {
        return e
      }, i.$.get = function () {
        return s
      }, Object.defineProperties(t, i), t
    }(l),
    R = {
      name: "device",
      proto: {
        device: I
      },
      static: {
        device: I
      }
    },
    q = {
      name: "support",
      proto: {
        support: o
      },
      static: {
        support: o
      }
    },
    j = {
      isEdge: !!t.navigator.userAgent.match(/Edge/g),
      isSafari: function () {
        var e = t.navigator.userAgent.toLowerCase();
        return e.indexOf("safari") >= 0 && e.indexOf("chrome") < 0 && e.indexOf("android") < 0
      }(),
      isUiWebView: /(iPhone|iPod|iPad).*AppleWebKit(?!.*Safari)/i.test(t.navigator.userAgent)
    },
    K = {
      name: "browser",
      proto: {
        browser: j
      },
      static: {
        browser: j
      }
    },
    U = {
      name: "resize",
      create: function () {
        var e = this;
        n.extend(e, {
          resize: {
            resizeHandler: function () {
              e && !e.destroyed && e.initialized && (e.emit("beforeResize"), e.emit("resize"))
            },
            orientationChangeHandler: function () {
              e && !e.destroyed && e.initialized && e.emit("orientationchange")
            }
          }
        })
      },
      on: {
        init: function () {
          t.addEventListener("resize", this.resize.resizeHandler), t.addEventListener("orientationchange", this.resize.orientationChangeHandler)
        },
        destroy: function () {
          t.removeEventListener("resize", this.resize.resizeHandler), t.removeEventListener("orientationchange", this.resize.orientationChangeHandler)
        }
      }
    },
    _ = {
      func: t.MutationObserver || t.WebkitMutationObserver,
      attach: function (e, i) {
        void 0 === i && (i = {});
        var s = this,
          a = new (0, _.func)((function (e) {
            if (1 !== e.length) {
              var i = function () {
                s.emit("observerUpdate", e[0])
              };
              t.requestAnimationFrame ? t.requestAnimationFrame(i) : t.setTimeout(i, 0)
            } else s.emit("observerUpdate", e[0])
          }));
        a.observe(e, {
          attributes: void 0 === i.attributes || i.attributes,
          childList: void 0 === i.childList || i.childList,
          characterData: void 0 === i.characterData || i.characterData
        }), s.observer.observers.push(a)
      },
      init: function () {
        if (o.observer && this.params.observer) {
          if (this.params.observeParents)
            for (var e = this.$el.parents(), t = 0; t < e.length; t += 1) this.observer.attach(e[t]);
          this.observer.attach(this.$el[0], {
            childList: this.params.observeSlideChildren
          }), this.observer.attach(this.$wrapperEl[0], {
            attributes: !1
          })
        }
      },
      destroy: function () {
        this.observer.observers.forEach((function (e) {
          e.disconnect()
        })), this.observer.observers = []
      }
    },
    Z = {
      name: "observer",
      params: {
        observer: !1,
        observeParents: !1,
        observeSlideChildren: !1
      },
      create: function () {
        n.extend(this, {
          observer: {
            init: _.init.bind(this),
            attach: _.attach.bind(this),
            destroy: _.destroy.bind(this),
            observers: []
          }
        })
      },
      on: {
        init: function () {
          this.observer.init()
        },
        destroy: function () {
          this.observer.destroy()
        }
      }
    },
    Q = {
      update: function (e) {
        var t = this,
          i = t.params,
          s = i.slidesPerView,
          a = i.slidesPerGroup,
          r = i.centeredSlides,
          o = t.params.virtual,
          l = o.addSlidesBefore,
          d = o.addSlidesAfter,
          h = t.virtual,
          p = h.from,
          c = h.to,
          u = h.slides,
          v = h.slidesGrid,
          f = h.renderSlide,
          m = h.offset;
        t.updateActiveIndex();
        var g, b, w, y = t.activeIndex || 0;
        g = t.rtlTranslate ? "right" : t.isHorizontal() ? "left" : "top", r ? (b = Math.floor(s / 2) + a + l, w = Math.floor(s / 2) + a + d) : (b = s + (a - 1) + l, w = a + d);
        var x = Math.max((y || 0) - w, 0),
          T = Math.min((y || 0) + b, u.length - 1),
          E = (t.slidesGrid[x] || 0) - (t.slidesGrid[0] || 0);

        function S() {
          t.updateSlides(), t.updateProgress(), t.updateSlidesClasses(), t.lazy && t.params.lazy.enabled && t.lazy.load()
        }
        if (n.extend(t.virtual, {
          from: x,
          to: T,
          offset: E,
          slidesGrid: t.slidesGrid
        }), p === x && c === T && !e) return t.slidesGrid !== v && E !== m && t.slides.css(g, E + "px"), void t.updateProgress();
        if (t.params.virtual.renderExternal) return t.params.virtual.renderExternal.call(t, {
          offset: E,
          from: x,
          to: T,
          slides: function () {
            for (var e = [], t = x; t <= T; t += 1) e.push(u[t]);
            return e
          }()
        }), void S();
        var C = [],
          M = [];
        if (e) t.$wrapperEl.find("." + t.params.slideClass).remove();
        else
          for (var P = p; P <= c; P += 1)(P < x || P > T) && t.$wrapperEl.find("." + t.params.slideClass + '[data-swiper-slide-index="' + P + '"]').remove();
        for (var z = 0; z < u.length; z += 1) z >= x && z <= T && (void 0 === c || e ? M.push(z) : (z > c && M.push(z), z < p && C.push(z)));
        M.forEach((function (e) {
          t.$wrapperEl.append(f(u[e], e))
        })), C.sort((function (e, t) {
          return t - e
        })).forEach((function (e) {
          t.$wrapperEl.prepend(f(u[e], e))
        })), t.$wrapperEl.children(".swiper-slide").css(g, E + "px"), S()
      },
      renderSlide: function (e, t) {
        var i = this.params.virtual;
        if (i.cache && this.virtual.cache[t]) return this.virtual.cache[t];
        var a = i.renderSlide ? s(i.renderSlide.call(this, e, t)) : s('<div class="' + this.params.slideClass + '" data-swiper-slide-index="' + t + '">' + e + "</div>");
        return a.attr("data-swiper-slide-index") || a.attr("data-swiper-slide-index", t), i.cache && (this.virtual.cache[t] = a), a
      },
      appendSlide: function (e) {
        if ("object" == typeof e && "length" in e)
          for (var t = 0; t < e.length; t += 1) e[t] && this.virtual.slides.push(e[t]);
        else this.virtual.slides.push(e);
        this.virtual.update(!0)
      },
      prependSlide: function (e) {
        var t = this.activeIndex,
          i = t + 1,
          s = 1;
        if (Array.isArray(e)) {
          for (var a = 0; a < e.length; a += 1) e[a] && this.virtual.slides.unshift(e[a]);
          i = t + e.length, s = e.length
        } else this.virtual.slides.unshift(e);
        if (this.params.virtual.cache) {
          var r = this.virtual.cache,
            n = {};
          Object.keys(r).forEach((function (e) {
            var t = r[e],
              i = t.attr("data-swiper-slide-index");
            i && t.attr("data-swiper-slide-index", parseInt(i, 10) + 1), n[parseInt(e, 10) + s] = t
          })), this.virtual.cache = n
        }
        this.virtual.update(!0), this.slideTo(i, 0)
      },
      removeSlide: function (e) {
        if (null != e) {
          var t = this.activeIndex;
          if (Array.isArray(e))
            for (var i = e.length - 1; i >= 0; i -= 1) this.virtual.slides.splice(e[i], 1), this.params.virtual.cache && delete this.virtual.cache[e[i]], e[i] < t && (t -= 1), t = Math.max(t, 0);
          else this.virtual.slides.splice(e, 1), this.params.virtual.cache && delete this.virtual.cache[e], e < t && (t -= 1), t = Math.max(t, 0);
          this.virtual.update(!0), this.slideTo(t, 0)
        }
      },
      removeAllSlides: function () {
        this.virtual.slides = [], this.params.virtual.cache && (this.virtual.cache = {}), this.virtual.update(!0), this.slideTo(0, 0)
      }
    },
    J = {
      name: "virtual",
      params: {
        virtual: {
          enabled: !1,
          slides: [],
          cache: !0,
          renderSlide: null,
          renderExternal: null,
          addSlidesBefore: 0,
          addSlidesAfter: 0
        }
      },
      create: function () {
        n.extend(this, {
          virtual: {
            update: Q.update.bind(this),
            appendSlide: Q.appendSlide.bind(this),
            prependSlide: Q.prependSlide.bind(this),
            removeSlide: Q.removeSlide.bind(this),
            removeAllSlides: Q.removeAllSlides.bind(this),
            renderSlide: Q.renderSlide.bind(this),
            slides: this.params.virtual.slides,
            cache: {}
          }
        })
      },
      on: {
        beforeInit: function () {
          if (this.params.virtual.enabled) {
            this.classNames.push(this.params.containerModifierClass + "virtual");
            var e = {
              watchSlidesProgress: !0
            };
            n.extend(this.params, e), n.extend(this.originalParams, e), this.params.initialSlide || this.virtual.update()
          }
        },
        setTranslate: function () {
          this.params.virtual.enabled && this.virtual.update()
        }
      }
    },
    ee = {
      handle: function (i) {
        var s = this.rtlTranslate,
          a = i;
        a.originalEvent && (a = a.originalEvent);
        var r = a.keyCode || a.charCode;
        if (!this.allowSlideNext && (this.isHorizontal() && 39 === r || this.isVertical() && 40 === r || 34 === r)) return !1;
        if (!this.allowSlidePrev && (this.isHorizontal() && 37 === r || this.isVertical() && 38 === r || 33 === r)) return !1;
        if (!(a.shiftKey || a.altKey || a.ctrlKey || a.metaKey || e.activeElement && e.activeElement.nodeName && ("input" === e.activeElement.nodeName.toLowerCase() || "textarea" === e.activeElement.nodeName.toLowerCase()))) {
          if (this.params.keyboard.onlyInViewport && (33 === r || 34 === r || 37 === r || 39 === r || 38 === r || 40 === r)) {
            var n = !1;
            if (this.$el.parents("." + this.params.slideClass).length > 0 && 0 === this.$el.parents("." + this.params.slideActiveClass).length) return;
            var o = t.innerWidth,
              l = t.innerHeight,
              d = this.$el.offset();
            s && (d.left -= this.$el[0].scrollLeft);
            for (var h = [
              [d.left, d.top],
              [d.left + this.width, d.top],
              [d.left, d.top + this.height],
              [d.left + this.width, d.top + this.height]
            ], p = 0; p < h.length; p += 1) {
              var c = h[p];
              c[0] >= 0 && c[0] <= o && c[1] >= 0 && c[1] <= l && (n = !0)
            }
            if (!n) return
          }
          this.isHorizontal() ? (33 !== r && 34 !== r && 37 !== r && 39 !== r || (a.preventDefault ? a.preventDefault() : a.returnValue = !1), (34 !== r && 39 !== r || s) && (33 !== r && 37 !== r || !s) || this.slideNext(), (33 !== r && 37 !== r || s) && (34 !== r && 39 !== r || !s) || this.slidePrev()) : (33 !== r && 34 !== r && 38 !== r && 40 !== r || (a.preventDefault ? a.preventDefault() : a.returnValue = !1), 34 !== r && 40 !== r || this.slideNext(), 33 !== r && 38 !== r || this.slidePrev()), this.emit("keyPress", r)
        }
      },
      enable: function () {
        this.keyboard.enabled || (s(e).on("keydown", this.keyboard.handle), this.keyboard.enabled = !0)
      },
      disable: function () {
        this.keyboard.enabled && (s(e).off("keydown", this.keyboard.handle), this.keyboard.enabled = !1)
      }
    },
    te = {
      name: "keyboard",
      params: {
        keyboard: {
          enabled: !1,
          onlyInViewport: !0
        }
      },
      create: function () {
        n.extend(this, {
          keyboard: {
            enabled: !1,
            enable: ee.enable.bind(this),
            disable: ee.disable.bind(this),
            handle: ee.handle.bind(this)
          }
        })
      },
      on: {
        init: function () {
          this.params.keyboard.enabled && this.keyboard.enable()
        },
        destroy: function () {
          this.keyboard.enabled && this.keyboard.disable()
        }
      }
    };
  var ie = {
    lastScrollTime: n.now(),
    lastEventBeforeSnap: void 0,
    recentWheelEvents: [],
    event: function () {
      return t.navigator.userAgent.indexOf("firefox") > -1 ? "DOMMouseScroll" : function () {
        var t = "onwheel" in e;
        if (!t) {
          var i = e.createElement("div");
          i.setAttribute("onwheel", "return;"), t = "function" == typeof i.onwheel
        }
        return !t && e.implementation && e.implementation.hasFeature && !0 !== e.implementation.hasFeature("", "") && (t = e.implementation.hasFeature("Events.wheel", "3.0")), t
      }() ? "wheel" : "mousewheel"
    },
    normalize: function (e) {
      var t = 0,
        i = 0,
        s = 0,
        a = 0;
      return "detail" in e && (i = e.detail), "wheelDelta" in e && (i = -e.wheelDelta / 120), "wheelDeltaY" in e && (i = -e.wheelDeltaY / 120), "wheelDeltaX" in e && (t = -e.wheelDeltaX / 120), "axis" in e && e.axis === e.HORIZONTAL_AXIS && (t = i, i = 0), s = 10 * t, a = 10 * i, "deltaY" in e && (a = e.deltaY), "deltaX" in e && (s = e.deltaX), e.shiftKey && !s && (s = a, a = 0), (s || a) && e.deltaMode && (1 === e.deltaMode ? (s *= 40, a *= 40) : (s *= 800, a *= 800)), s && !t && (t = s < 1 ? -1 : 1), a && !i && (i = a < 1 ? -1 : 1), {
        spinX: t,
        spinY: i,
        pixelX: s,
        pixelY: a
      }
    },
    handleMouseEnter: function () {
      this.mouseEntered = !0
    },
    handleMouseLeave: function () {
      this.mouseEntered = !1
    },
    handle: function (e) {
      var t = e,
        i = this,
        a = i.params.mousewheel;
      i.params.cssMode && t.preventDefault();
      var r = i.$el;
      if ("container" !== i.params.mousewheel.eventsTarged && (r = s(i.params.mousewheel.eventsTarged)), !i.mouseEntered && !r[0].contains(t.target) && !a.releaseOnEdges) return !0;
      t.originalEvent && (t = t.originalEvent);
      var o = 0,
        l = i.rtlTranslate ? -1 : 1,
        d = ie.normalize(t);
      if (a.forceToAxis)
        if (i.isHorizontal()) {
          if (!(Math.abs(d.pixelX) > Math.abs(d.pixelY))) return !0;
          o = d.pixelX * l
        } else {
          if (!(Math.abs(d.pixelY) > Math.abs(d.pixelX))) return !0;
          o = d.pixelY
        }
      else o = Math.abs(d.pixelX) > Math.abs(d.pixelY) ? -d.pixelX * l : -d.pixelY;
      if (0 === o) return !0;
      if (a.invert && (o = -o), i.params.freeMode) {
        var h = {
          time: n.now(),
          delta: Math.abs(o),
          direction: Math.sign(o)
        },
          p = i.mousewheel.lastEventBeforeSnap,
          c = p && h.time < p.time + 500 && h.delta <= p.delta && h.direction === p.direction;
        if (!c) {
          i.mousewheel.lastEventBeforeSnap = void 0, i.params.loop && i.loopFix();
          var u = i.getTranslate() + o * a.sensitivity,
            v = i.isBeginning,
            f = i.isEnd;
          if (u >= i.minTranslate() && (u = i.minTranslate()), u <= i.maxTranslate() && (u = i.maxTranslate()), i.setTransition(0), i.setTranslate(u), i.updateProgress(), i.updateActiveIndex(), i.updateSlidesClasses(), (!v && i.isBeginning || !f && i.isEnd) && i.updateSlidesClasses(), i.params.freeModeSticky) {
            clearTimeout(i.mousewheel.timeout), i.mousewheel.timeout = void 0;
            var m = i.mousewheel.recentWheelEvents;
            m.length >= 15 && m.shift();
            var g = m.length ? m[m.length - 1] : void 0,
              b = m[0];
            if (m.push(h), g && (h.delta > g.delta || h.direction !== g.direction)) m.splice(0);
            else if (m.length >= 15 && h.time - b.time < 500 && b.delta - h.delta >= 1 && h.delta <= 6) {
              var w = o > 0 ? .8 : .2;
              i.mousewheel.lastEventBeforeSnap = h, m.splice(0), i.mousewheel.timeout = n.nextTick((function () {
                i.slideToClosest(i.params.speed, !0, void 0, w)
              }), 0)
            }
            i.mousewheel.timeout || (i.mousewheel.timeout = n.nextTick((function () {
              i.mousewheel.lastEventBeforeSnap = h, m.splice(0), i.slideToClosest(i.params.speed, !0, void 0, .5)
            }), 500))
          }
          if (c || i.emit("scroll", t), i.params.autoplay && i.params.autoplayDisableOnInteraction && i.autoplay.stop(), u === i.minTranslate() || u === i.maxTranslate()) return !0
        }
      } else {
        var y = {
          time: n.now(),
          delta: Math.abs(o),
          direction: Math.sign(o),
          raw: e
        },
          x = i.mousewheel.recentWheelEvents;
        x.length >= 2 && x.shift();
        var T = x.length ? x[x.length - 1] : void 0;
        if (x.push(y), T ? (y.direction !== T.direction || y.delta > T.delta) && i.mousewheel.animateSlider(y) : i.mousewheel.animateSlider(y), i.mousewheel.releaseScroll(y)) return !0
      }
      return t.preventDefault ? t.preventDefault() : t.returnValue = !1, !1
    },
    animateSlider: function (e) {
      return e.delta >= 6 && n.now() - this.mousewheel.lastScrollTime < 60 || (e.direction < 0 ? this.isEnd && !this.params.loop || this.animating || (this.slideNext(), this.emit("scroll", e.raw)) : this.isBeginning && !this.params.loop || this.animating || (this.slidePrev(), this.emit("scroll", e.raw)), this.mousewheel.lastScrollTime = (new t.Date).getTime(), !1)
    },
    releaseScroll: function (e) {
      var t = this.params.mousewheel;
      if (e.direction < 0) {
        if (this.isEnd && !this.params.loop && t.releaseOnEdges) return !0
      } else if (this.isBeginning && !this.params.loop && t.releaseOnEdges) return !0;
      return !1
    },
    enable: function () {
      var e = ie.event();
      if (this.params.cssMode) return this.wrapperEl.removeEventListener(e, this.mousewheel.handle), !0;
      if (!e) return !1;
      if (this.mousewheel.enabled) return !1;
      var t = this.$el;
      return "container" !== this.params.mousewheel.eventsTarged && (t = s(this.params.mousewheel.eventsTarged)), t.on("mouseenter", this.mousewheel.handleMouseEnter), t.on("mouseleave", this.mousewheel.handleMouseLeave), t.on(e, this.mousewheel.handle), this.mousewheel.enabled = !0, !0
    },
    disable: function () {
      var e = ie.event();
      if (this.params.cssMode) return this.wrapperEl.addEventListener(e, this.mousewheel.handle), !0;
      if (!e) return !1;
      if (!this.mousewheel.enabled) return !1;
      var t = this.$el;
      return "container" !== this.params.mousewheel.eventsTarged && (t = s(this.params.mousewheel.eventsTarged)), t.off(e, this.mousewheel.handle), this.mousewheel.enabled = !1, !0
    }
  },
    se = {
      update: function () {
        var e = this.params.navigation;
        if (!this.params.loop) {
          var t = this.navigation,
            i = t.$nextEl,
            s = t.$prevEl;
          s && s.length > 0 && (this.isBeginning ? s.addClass(e.disabledClass) : s.removeClass(e.disabledClass), s[this.params.watchOverflow && this.isLocked ? "addClass" : "removeClass"](e.lockClass)), i && i.length > 0 && (this.isEnd ? i.addClass(e.disabledClass) : i.removeClass(e.disabledClass), i[this.params.watchOverflow && this.isLocked ? "addClass" : "removeClass"](e.lockClass))
        }
      },
      onPrevClick: function (e) {
        e.preventDefault(), this.isBeginning && !this.params.loop || this.slidePrev()
      },
      onNextClick: function (e) {
        e.preventDefault(), this.isEnd && !this.params.loop || this.slideNext()
      },
      init: function () {
        var e, t, i = this.params.navigation;
        (i.nextEl || i.prevEl) && (i.nextEl && (e = s(i.nextEl), this.params.uniqueNavElements && "string" == typeof i.nextEl && e.length > 1 && 1 === this.$el.find(i.nextEl).length && (e = this.$el.find(i.nextEl))), i.prevEl && (t = s(i.prevEl), this.params.uniqueNavElements && "string" == typeof i.prevEl && t.length > 1 && 1 === this.$el.find(i.prevEl).length && (t = this.$el.find(i.prevEl))), e && e.length > 0 && e.on("click", this.navigation.onNextClick), t && t.length > 0 && t.on("click", this.navigation.onPrevClick), n.extend(this.navigation, {
          $nextEl: e,
          nextEl: e && e[0],
          $prevEl: t,
          prevEl: t && t[0]
        }))
      },
      destroy: function () {
        var e = this.navigation,
          t = e.$nextEl,
          i = e.$prevEl;
        t && t.length && (t.off("click", this.navigation.onNextClick), t.removeClass(this.params.navigation.disabledClass)), i && i.length && (i.off("click", this.navigation.onPrevClick), i.removeClass(this.params.navigation.disabledClass))
      }
    },
    ae = {
      update: function () {
        var e = this.rtl,
          t = this.params.pagination;
        if (t.el && this.pagination.el && this.pagination.$el && 0 !== this.pagination.$el.length) {
          var i, a = this.virtual && this.params.virtual.enabled ? this.virtual.slides.length : this.slides.length,
            r = this.pagination.$el,
            n = this.params.loop ? Math.ceil((a - 2 * this.loopedSlides) / this.params.slidesPerGroup) : this.snapGrid.length;
          if (this.params.loop ? ((i = Math.ceil((this.activeIndex - this.loopedSlides) / this.params.slidesPerGroup)) > a - 1 - 2 * this.loopedSlides && (i -= a - 2 * this.loopedSlides), i > n - 1 && (i -= n), i < 0 && "bullets" !== this.params.paginationType && (i = n + i)) : i = void 0 !== this.snapIndex ? this.snapIndex : this.activeIndex || 0, "bullets" === t.type && this.pagination.bullets && this.pagination.bullets.length > 0) {
            var o, l, d, h = this.pagination.bullets;
            if (t.dynamicBullets && (this.pagination.bulletSize = h.eq(0)[this.isHorizontal() ? "outerWidth" : "outerHeight"](!0), r.css(this.isHorizontal() ? "width" : "height", this.pagination.bulletSize * (t.dynamicMainBullets + 4) + "px"), t.dynamicMainBullets > 1 && void 0 !== this.previousIndex && (this.pagination.dynamicBulletIndex += i - this.previousIndex, this.pagination.dynamicBulletIndex > t.dynamicMainBullets - 1 ? this.pagination.dynamicBulletIndex = t.dynamicMainBullets - 1 : this.pagination.dynamicBulletIndex < 0 && (this.pagination.dynamicBulletIndex = 0)), o = i - this.pagination.dynamicBulletIndex, d = ((l = o + (Math.min(h.length, t.dynamicMainBullets) - 1)) + o) / 2), h.removeClass(t.bulletActiveClass + " " + t.bulletActiveClass + "-next " + t.bulletActiveClass + "-next-next " + t.bulletActiveClass + "-prev " + t.bulletActiveClass + "-prev-prev " + t.bulletActiveClass + "-main"), r.length > 1) h.each((function (e, a) {
              var r = s(a),
                n = r.index();
              n === i && r.addClass(t.bulletActiveClass), t.dynamicBullets && (n >= o && n <= l && r.addClass(t.bulletActiveClass + "-main"), n === o && r.prev().addClass(t.bulletActiveClass + "-prev").prev().addClass(t.bulletActiveClass + "-prev-prev"), n === l && r.next().addClass(t.bulletActiveClass + "-next").next().addClass(t.bulletActiveClass + "-next-next"))
            }));
            else {
              var p = h.eq(i),
                c = p.index();
              if (p.addClass(t.bulletActiveClass), t.dynamicBullets) {
                for (var u = h.eq(o), v = h.eq(l), f = o; f <= l; f += 1) h.eq(f).addClass(t.bulletActiveClass + "-main");
                if (this.params.loop)
                  if (c >= h.length - t.dynamicMainBullets) {
                    for (var m = t.dynamicMainBullets; m >= 0; m -= 1) h.eq(h.length - m).addClass(t.bulletActiveClass + "-main");
                    h.eq(h.length - t.dynamicMainBullets - 1).addClass(t.bulletActiveClass + "-prev")
                  } else u.prev().addClass(t.bulletActiveClass + "-prev").prev().addClass(t.bulletActiveClass + "-prev-prev"), v.next().addClass(t.bulletActiveClass + "-next").next().addClass(t.bulletActiveClass + "-next-next");
                else u.prev().addClass(t.bulletActiveClass + "-prev").prev().addClass(t.bulletActiveClass + "-prev-prev"), v.next().addClass(t.bulletActiveClass + "-next").next().addClass(t.bulletActiveClass + "-next-next")
              }
            }
            if (t.dynamicBullets) {
              var g = Math.min(h.length, t.dynamicMainBullets + 4),
                b = (this.pagination.bulletSize * g - this.pagination.bulletSize) / 2 - d * this.pagination.bulletSize,
                w = e ? "right" : "left";
              h.css(this.isHorizontal() ? w : "top", b + "px")
            }
          }
          if ("fraction" === t.type && (r.find("." + t.currentClass).text(t.formatFractionCurrent(i + 1)), r.find("." + t.totalClass).text(t.formatFractionTotal(n))), "progressbar" === t.type) {
            var y;
            y = t.progressbarOpposite ? this.isHorizontal() ? "vertical" : "horizontal" : this.isHorizontal() ? "horizontal" : "vertical";
            var x = (i + 1) / n,
              T = 1,
              E = 1;
            "horizontal" === y ? T = x : E = x, r.find("." + t.progressbarFillClass).transform("translate3d(0,0,0) scaleX(" + T + ") scaleY(" + E + ")").transition(this.params.speed)
          }
          "custom" === t.type && t.renderCustom ? (r.html(t.renderCustom(this, i + 1, n)), this.emit("paginationRender", this, r[0])) : this.emit("paginationUpdate", this, r[0]), r[this.params.watchOverflow && this.isLocked ? "addClass" : "removeClass"](t.lockClass)
        }
      },
      render: function () {
        var e = this.params.pagination;
        if (e.el && this.pagination.el && this.pagination.$el && 0 !== this.pagination.$el.length) {
          var t = this.virtual && this.params.virtual.enabled ? this.virtual.slides.length : this.slides.length,
            i = this.pagination.$el,
            s = "";
          if ("bullets" === e.type) {
            for (var a = this.params.loop ? Math.ceil((t - 2 * this.loopedSlides) / this.params.slidesPerGroup) : this.snapGrid.length, r = 0; r < a; r += 1) e.renderBullet ? s += e.renderBullet.call(this, r, e.bulletClass) : s += "<" + e.bulletElement + ' class="' + e.bulletClass + '"></' + e.bulletElement + ">";
            i.html(s), this.pagination.bullets = i.find("." + e.bulletClass)
          }
          "fraction" === e.type && (s = e.renderFraction ? e.renderFraction.call(this, e.currentClass, e.totalClass) : '<span class="' + e.currentClass + '"></span> / <span class="' + e.totalClass + '"></span>', i.html(s)), "progressbar" === e.type && (s = e.renderProgressbar ? e.renderProgressbar.call(this, e.progressbarFillClass) : '<span class="' + e.progressbarFillClass + '"></span>', i.html(s)), "custom" !== e.type && this.emit("paginationRender", this.pagination.$el[0])
        }
      },
      init: function () {
        var e = this,
          t = e.params.pagination;
        if (t.el) {
          var i = s(t.el);
          0 !== i.length && (e.params.uniqueNavElements && "string" == typeof t.el && i.length > 1 && 1 === e.$el.find(t.el).length && (i = e.$el.find(t.el)), "bullets" === t.type && t.clickable && i.addClass(t.clickableClass), i.addClass(t.modifierClass + t.type), "bullets" === t.type && t.dynamicBullets && (i.addClass("" + t.modifierClass + t.type + "-dynamic"), e.pagination.dynamicBulletIndex = 0, t.dynamicMainBullets < 1 && (t.dynamicMainBullets = 1)), "progressbar" === t.type && t.progressbarOpposite && i.addClass(t.progressbarOppositeClass), t.clickable && i.on("click", "." + t.bulletClass, (function (t) {
            t.preventDefault();
            var i = s(this).index() * e.params.slidesPerGroup;
            e.params.loop && (i += e.loopedSlides), e.slideTo(i)
          })), n.extend(e.pagination, {
            $el: i,
            el: i[0]
          }))
        }
      },
      destroy: function () {
        var e = this.params.pagination;
        if (e.el && this.pagination.el && this.pagination.$el && 0 !== this.pagination.$el.length) {
          var t = this.pagination.$el;
          t.removeClass(e.hiddenClass), t.removeClass(e.modifierClass + e.type), this.pagination.bullets && this.pagination.bullets.removeClass(e.bulletActiveClass), e.clickable && t.off("click", "." + e.bulletClass)
        }
      }
    },
    re = {
      setTranslate: function () {
        if (this.params.scrollbar.el && this.scrollbar.el) {
          var e = this.scrollbar,
            t = this.rtlTranslate,
            i = this.progress,
            s = e.dragSize,
            a = e.trackSize,
            r = e.$dragEl,
            n = e.$el,
            o = this.params.scrollbar,
            l = s,
            d = (a - s) * i;
          t ? (d = -d) > 0 ? (l = s - d, d = 0) : -d + s > a && (l = a + d) : d < 0 ? (l = s + d, d = 0) : d + s > a && (l = a - d), this.isHorizontal() ? (r.transform("translate3d(" + d + "px, 0, 0)"), r[0].style.width = l + "px") : (r.transform("translate3d(0px, " + d + "px, 0)"), r[0].style.height = l + "px"), o.hide && (clearTimeout(this.scrollbar.timeout), n[0].style.opacity = 1, this.scrollbar.timeout = setTimeout((function () {
            n[0].style.opacity = 0, n.transition(400)
          }), 1e3))
        }
      },
      setTransition: function (e) {
        this.params.scrollbar.el && this.scrollbar.el && this.scrollbar.$dragEl.transition(e)
      },
      updateSize: function () {
        if (this.params.scrollbar.el && this.scrollbar.el) {
          var e = this.scrollbar,
            t = e.$dragEl,
            i = e.$el;
          t[0].style.width = "", t[0].style.height = "";
          var s, a = this.isHorizontal() ? i[0].offsetWidth : i[0].offsetHeight,
            r = this.size / this.virtualSize,
            o = r * (a / this.size);
          s = "auto" === this.params.scrollbar.dragSize ? a * r : parseInt(this.params.scrollbar.dragSize, 10), this.isHorizontal() ? t[0].style.width = s + "px" : t[0].style.height = s + "px", i[0].style.display = r >= 1 ? "none" : "", this.params.scrollbar.hide && (i[0].style.opacity = 0), n.extend(e, {
            trackSize: a,
            divider: r,
            moveDivider: o,
            dragSize: s
          }), e.$el[this.params.watchOverflow && this.isLocked ? "addClass" : "removeClass"](this.params.scrollbar.lockClass)
        }
      },
      getPointerPosition: function (e) {
        return this.isHorizontal() ? "touchstart" === e.type || "touchmove" === e.type ? e.targetTouches[0].clientX : e.clientX : "touchstart" === e.type || "touchmove" === e.type ? e.targetTouches[0].clientY : e.clientY
      },
      setDragPosition: function (e) {
        var t, i = this.scrollbar,
          s = this.rtlTranslate,
          a = i.$el,
          r = i.dragSize,
          n = i.trackSize,
          o = i.dragStartPos;
        t = (i.getPointerPosition(e) - a.offset()[this.isHorizontal() ? "left" : "top"] - (null !== o ? o : r / 2)) / (n - r), t = Math.max(Math.min(t, 1), 0), s && (t = 1 - t);
        var l = this.minTranslate() + (this.maxTranslate() - this.minTranslate()) * t;
        this.updateProgress(l), this.setTranslate(l), this.updateActiveIndex(), this.updateSlidesClasses()
      },
      onDragStart: function (e) {
        var t = this.params.scrollbar,
          i = this.scrollbar,
          s = this.$wrapperEl,
          a = i.$el,
          r = i.$dragEl;
        this.scrollbar.isTouched = !0, this.scrollbar.dragStartPos = e.target === r[0] || e.target === r ? i.getPointerPosition(e) - e.target.getBoundingClientRect()[this.isHorizontal() ? "left" : "top"] : null, e.preventDefault(), e.stopPropagation(), s.transition(100), r.transition(100), i.setDragPosition(e), clearTimeout(this.scrollbar.dragTimeout), a.transition(0), t.hide && a.css("opacity", 1), this.params.cssMode && this.$wrapperEl.css("scroll-snap-type", "none"), this.emit("scrollbarDragStart", e)
      },
      onDragMove: function (e) {
        var t = this.scrollbar,
          i = this.$wrapperEl,
          s = t.$el,
          a = t.$dragEl;
        this.scrollbar.isTouched && (e.preventDefault ? e.preventDefault() : e.returnValue = !1, t.setDragPosition(e), i.transition(0), s.transition(0), a.transition(0), this.emit("scrollbarDragMove", e))
      },
      onDragEnd: function (e) {
        var t = this.params.scrollbar,
          i = this.scrollbar,
          s = this.$wrapperEl,
          a = i.$el;
        this.scrollbar.isTouched && (this.scrollbar.isTouched = !1, this.params.cssMode && (this.$wrapperEl.css("scroll-snap-type", ""), s.transition("")), t.hide && (clearTimeout(this.scrollbar.dragTimeout), this.scrollbar.dragTimeout = n.nextTick((function () {
          a.css("opacity", 0), a.transition(400)
        }), 1e3)), this.emit("scrollbarDragEnd", e), t.snapOnRelease && this.slideToClosest())
      },
      enableDraggable: function () {
        if (this.params.scrollbar.el) {
          var t = this.scrollbar,
            i = this.touchEventsTouch,
            s = this.touchEventsDesktop,
            a = this.params,
            r = t.$el[0],
            n = !(!o.passiveListener || !a.passiveListeners) && {
              passive: !1,
              capture: !1
            },
            l = !(!o.passiveListener || !a.passiveListeners) && {
              passive: !0,
              capture: !1
            };
          o.touch ? (r.addEventListener(i.start, this.scrollbar.onDragStart, n), r.addEventListener(i.move, this.scrollbar.onDragMove, n), r.addEventListener(i.end, this.scrollbar.onDragEnd, l)) : (r.addEventListener(s.start, this.scrollbar.onDragStart, n), e.addEventListener(s.move, this.scrollbar.onDragMove, n), e.addEventListener(s.end, this.scrollbar.onDragEnd, l))
        }
      },
      disableDraggable: function () {
        if (this.params.scrollbar.el) {
          var t = this.scrollbar,
            i = this.touchEventsTouch,
            s = this.touchEventsDesktop,
            a = this.params,
            r = t.$el[0],
            n = !(!o.passiveListener || !a.passiveListeners) && {
              passive: !1,
              capture: !1
            },
            l = !(!o.passiveListener || !a.passiveListeners) && {
              passive: !0,
              capture: !1
            };
          o.touch ? (r.removeEventListener(i.start, this.scrollbar.onDragStart, n), r.removeEventListener(i.move, this.scrollbar.onDragMove, n), r.removeEventListener(i.end, this.scrollbar.onDragEnd, l)) : (r.removeEventListener(s.start, this.scrollbar.onDragStart, n), e.removeEventListener(s.move, this.scrollbar.onDragMove, n), e.removeEventListener(s.end, this.scrollbar.onDragEnd, l))
        }
      },
      init: function () {
        if (this.params.scrollbar.el) {
          var e = this.scrollbar,
            t = this.$el,
            i = this.params.scrollbar,
            a = s(i.el);
          this.params.uniqueNavElements && "string" == typeof i.el && a.length > 1 && 1 === t.find(i.el).length && (a = t.find(i.el));
          var r = a.find("." + this.params.scrollbar.dragClass);
          0 === r.length && (r = s('<div class="' + this.params.scrollbar.dragClass + '"></div>'), a.append(r)), n.extend(e, {
            $el: a,
            el: a[0],
            $dragEl: r,
            dragEl: r[0]
          }), i.draggable && e.enableDraggable()
        }
      },
      destroy: function () {
        this.scrollbar.disableDraggable()
      }
    },
    ne = {
      setTransform: function (e, t) {
        var i = this.rtl,
          a = s(e),
          r = i ? -1 : 1,
          n = a.attr("data-swiper-parallax") || "0",
          o = a.attr("data-swiper-parallax-x"),
          l = a.attr("data-swiper-parallax-y"),
          d = a.attr("data-swiper-parallax-scale"),
          h = a.attr("data-swiper-parallax-opacity");
        if (o || l ? (o = o || "0", l = l || "0") : this.isHorizontal() ? (o = n, l = "0") : (l = n, o = "0"), o = o.indexOf("%") >= 0 ? parseInt(o, 10) * t * r + "%" : o * t * r + "px", l = l.indexOf("%") >= 0 ? parseInt(l, 10) * t + "%" : l * t + "px", null != h) {
          var p = h - (h - 1) * (1 - Math.abs(t));
          a[0].style.opacity = p
        }
        if (null == d) a.transform("translate3d(" + o + ", " + l + ", 0px)");
        else {
          var c = d - (d - 1) * (1 - Math.abs(t));
          a.transform("translate3d(" + o + ", " + l + ", 0px) scale(" + c + ")")
        }
      },
      setTranslate: function () {
        var e = this,
          t = e.$el,
          i = e.slides,
          a = e.progress,
          r = e.snapGrid;
        t.children("[data-swiper-parallax], [data-swiper-parallax-x], [data-swiper-parallax-y], [data-swiper-parallax-opacity], [data-swiper-parallax-scale]").each((function (t, i) {
          e.parallax.setTransform(i, a)
        })), i.each((function (t, i) {
          var n = i.progress;
          e.params.slidesPerGroup > 1 && "auto" !== e.params.slidesPerView && (n += Math.ceil(t / 2) - a * (r.length - 1)), n = Math.min(Math.max(n, -1), 1), s(i).find("[data-swiper-parallax], [data-swiper-parallax-x], [data-swiper-parallax-y], [data-swiper-parallax-opacity], [data-swiper-parallax-scale]").each((function (t, i) {
            e.parallax.setTransform(i, n)
          }))
        }))
      },
      setTransition: function (e) {
        void 0 === e && (e = this.params.speed);
        this.$el.find("[data-swiper-parallax], [data-swiper-parallax-x], [data-swiper-parallax-y], [data-swiper-parallax-opacity], [data-swiper-parallax-scale]").each((function (t, i) {
          var a = s(i),
            r = parseInt(a.attr("data-swiper-parallax-duration"), 10) || e;
          0 === e && (r = 0), a.transition(r)
        }))
      }
    },
    oe = {
      getDistanceBetweenTouches: function (e) {
        if (e.targetTouches.length < 2) return 1;
        var t = e.targetTouches[0].pageX,
          i = e.targetTouches[0].pageY,
          s = e.targetTouches[1].pageX,
          a = e.targetTouches[1].pageY;
        return Math.sqrt(Math.pow(s - t, 2) + Math.pow(a - i, 2))
      },
      onGestureStart: function (e) {
        var t = this.params.zoom,
          i = this.zoom,
          a = i.gesture;
        if (i.fakeGestureTouched = !1, i.fakeGestureMoved = !1, !o.gestures) {
          if ("touchstart" !== e.type || "touchstart" === e.type && e.targetTouches.length < 2) return;
          i.fakeGestureTouched = !0, a.scaleStart = oe.getDistanceBetweenTouches(e)
        }
        a.$slideEl && a.$slideEl.length || (a.$slideEl = s(e.target).closest("." + this.params.slideClass), 0 === a.$slideEl.length && (a.$slideEl = this.slides.eq(this.activeIndex)), a.$imageEl = a.$slideEl.find("img, svg, canvas, picture, .swiper-zoom-target"), a.$imageWrapEl = a.$imageEl.parent("." + t.containerClass), a.maxRatio = a.$imageWrapEl.attr("data-swiper-zoom") || t.maxRatio, 0 !== a.$imageWrapEl.length) ? (a.$imageEl.transition(0), this.zoom.isScaling = !0) : a.$imageEl = void 0
      },
      onGestureChange: function (e) {
        var t = this.params.zoom,
          i = this.zoom,
          s = i.gesture;
        if (!o.gestures) {
          if ("touchmove" !== e.type || "touchmove" === e.type && e.targetTouches.length < 2) return;
          i.fakeGestureMoved = !0, s.scaleMove = oe.getDistanceBetweenTouches(e)
        }
        s.$imageEl && 0 !== s.$imageEl.length && (o.gestures ? i.scale = e.scale * i.currentScale : i.scale = s.scaleMove / s.scaleStart * i.currentScale, i.scale > s.maxRatio && (i.scale = s.maxRatio - 1 + Math.pow(i.scale - s.maxRatio + 1, .5)), i.scale < t.minRatio && (i.scale = t.minRatio + 1 - Math.pow(t.minRatio - i.scale + 1, .5)), s.$imageEl.transform("translate3d(0,0,0) scale(" + i.scale + ")"))
      },
      onGestureEnd: function (e) {
        var t = this.params.zoom,
          i = this.zoom,
          s = i.gesture;
        if (!o.gestures) {
          if (!i.fakeGestureTouched || !i.fakeGestureMoved) return;
          if ("touchend" !== e.type || "touchend" === e.type && e.changedTouches.length < 2 && !I.android) return;
          i.fakeGestureTouched = !1, i.fakeGestureMoved = !1
        }
        s.$imageEl && 0 !== s.$imageEl.length && (i.scale = Math.max(Math.min(i.scale, s.maxRatio), t.minRatio), s.$imageEl.transition(this.params.speed).transform("translate3d(0,0,0) scale(" + i.scale + ")"), i.currentScale = i.scale, i.isScaling = !1, 1 === i.scale && (s.$slideEl = void 0))
      },
      onTouchStart: function (e) {
        var t = this.zoom,
          i = t.gesture,
          s = t.image;
        i.$imageEl && 0 !== i.$imageEl.length && (s.isTouched || (I.android && e.preventDefault(), s.isTouched = !0, s.touchesStart.x = "touchstart" === e.type ? e.targetTouches[0].pageX : e.pageX, s.touchesStart.y = "touchstart" === e.type ? e.targetTouches[0].pageY : e.pageY))
      },
      onTouchMove: function (e) {
        var t = this.zoom,
          i = t.gesture,
          s = t.image,
          a = t.velocity;
        if (i.$imageEl && 0 !== i.$imageEl.length && (this.allowClick = !1, s.isTouched && i.$slideEl)) {
          s.isMoved || (s.width = i.$imageEl[0].offsetWidth, s.height = i.$imageEl[0].offsetHeight, s.startX = n.getTranslate(i.$imageWrapEl[0], "x") || 0, s.startY = n.getTranslate(i.$imageWrapEl[0], "y") || 0, i.slideWidth = i.$slideEl[0].offsetWidth, i.slideHeight = i.$slideEl[0].offsetHeight, i.$imageWrapEl.transition(0), this.rtl && (s.startX = -s.startX, s.startY = -s.startY));
          var r = s.width * t.scale,
            o = s.height * t.scale;
          if (!(r < i.slideWidth && o < i.slideHeight)) {
            if (s.minX = Math.min(i.slideWidth / 2 - r / 2, 0), s.maxX = -s.minX, s.minY = Math.min(i.slideHeight / 2 - o / 2, 0), s.maxY = -s.minY, s.touchesCurrent.x = "touchmove" === e.type ? e.targetTouches[0].pageX : e.pageX, s.touchesCurrent.y = "touchmove" === e.type ? e.targetTouches[0].pageY : e.pageY, !s.isMoved && !t.isScaling) {
              if (this.isHorizontal() && (Math.floor(s.minX) === Math.floor(s.startX) && s.touchesCurrent.x < s.touchesStart.x || Math.floor(s.maxX) === Math.floor(s.startX) && s.touchesCurrent.x > s.touchesStart.x)) return void (s.isTouched = !1);
              if (!this.isHorizontal() && (Math.floor(s.minY) === Math.floor(s.startY) && s.touchesCurrent.y < s.touchesStart.y || Math.floor(s.maxY) === Math.floor(s.startY) && s.touchesCurrent.y > s.touchesStart.y)) return void (s.isTouched = !1)
            }
            e.preventDefault(), e.stopPropagation(), s.isMoved = !0, s.currentX = s.touchesCurrent.x - s.touchesStart.x + s.startX, s.currentY = s.touchesCurrent.y - s.touchesStart.y + s.startY, s.currentX < s.minX && (s.currentX = s.minX + 1 - Math.pow(s.minX - s.currentX + 1, .8)), s.currentX > s.maxX && (s.currentX = s.maxX - 1 + Math.pow(s.currentX - s.maxX + 1, .8)), s.currentY < s.minY && (s.currentY = s.minY + 1 - Math.pow(s.minY - s.currentY + 1, .8)), s.currentY > s.maxY && (s.currentY = s.maxY - 1 + Math.pow(s.currentY - s.maxY + 1, .8)), a.prevPositionX || (a.prevPositionX = s.touchesCurrent.x), a.prevPositionY || (a.prevPositionY = s.touchesCurrent.y), a.prevTime || (a.prevTime = Date.now()), a.x = (s.touchesCurrent.x - a.prevPositionX) / (Date.now() - a.prevTime) / 2, a.y = (s.touchesCurrent.y - a.prevPositionY) / (Date.now() - a.prevTime) / 2, Math.abs(s.touchesCurrent.x - a.prevPositionX) < 2 && (a.x = 0), Math.abs(s.touchesCurrent.y - a.prevPositionY) < 2 && (a.y = 0), a.prevPositionX = s.touchesCurrent.x, a.prevPositionY = s.touchesCurrent.y, a.prevTime = Date.now(), i.$imageWrapEl.transform("translate3d(" + s.currentX + "px, " + s.currentY + "px,0)")
          }
        }
      },
      onTouchEnd: function () {
        var e = this.zoom,
          t = e.gesture,
          i = e.image,
          s = e.velocity;
        if (t.$imageEl && 0 !== t.$imageEl.length) {
          if (!i.isTouched || !i.isMoved) return i.isTouched = !1, void (i.isMoved = !1);
          i.isTouched = !1, i.isMoved = !1;
          var a = 300,
            r = 300,
            n = s.x * a,
            o = i.currentX + n,
            l = s.y * r,
            d = i.currentY + l;
          0 !== s.x && (a = Math.abs((o - i.currentX) / s.x)), 0 !== s.y && (r = Math.abs((d - i.currentY) / s.y));
          var h = Math.max(a, r);
          i.currentX = o, i.currentY = d;
          var p = i.width * e.scale,
            c = i.height * e.scale;
          i.minX = Math.min(t.slideWidth / 2 - p / 2, 0), i.maxX = -i.minX, i.minY = Math.min(t.slideHeight / 2 - c / 2, 0), i.maxY = -i.minY, i.currentX = Math.max(Math.min(i.currentX, i.maxX), i.minX), i.currentY = Math.max(Math.min(i.currentY, i.maxY), i.minY), t.$imageWrapEl.transition(h).transform("translate3d(" + i.currentX + "px, " + i.currentY + "px,0)")
        }
      },
      onTransitionEnd: function () {
        var e = this.zoom,
          t = e.gesture;
        t.$slideEl && this.previousIndex !== this.activeIndex && (t.$imageEl.transform("translate3d(0,0,0) scale(1)"), t.$imageWrapEl.transform("translate3d(0,0,0)"), e.scale = 1, e.currentScale = 1, t.$slideEl = void 0, t.$imageEl = void 0, t.$imageWrapEl = void 0)
      },
      toggle: function (e) {
        var t = this.zoom;
        t.scale && 1 !== t.scale ? t.out() : t.in(e)
      },
      in: function (e) {
        var t, i, s, a, r, n, o, l, d, h, p, c, u, v, f, m, g = this.zoom,
          b = this.params.zoom,
          w = g.gesture,
          y = g.image;
        (w.$slideEl || (w.$slideEl = this.slides.eq(this.activeIndex), w.$imageEl = w.$slideEl.find("img, svg, canvas, picture, .swiper-zoom-target"), w.$imageWrapEl = w.$imageEl.parent("." + b.containerClass)), w.$imageEl && 0 !== w.$imageEl.length) && (w.$slideEl.addClass("" + b.zoomedSlideClass), void 0 === y.touchesStart.x && e ? (t = "touchend" === e.type ? e.changedTouches[0].pageX : e.pageX, i = "touchend" === e.type ? e.changedTouches[0].pageY : e.pageY) : (t = y.touchesStart.x, i = y.touchesStart.y), g.scale = w.$imageWrapEl.attr("data-swiper-zoom") || b.maxRatio, g.currentScale = w.$imageWrapEl.attr("data-swiper-zoom") || b.maxRatio, e ? (f = w.$slideEl[0].offsetWidth, m = w.$slideEl[0].offsetHeight, s = w.$slideEl.offset().left + f / 2 - t, a = w.$slideEl.offset().top + m / 2 - i, o = w.$imageEl[0].offsetWidth, l = w.$imageEl[0].offsetHeight, d = o * g.scale, h = l * g.scale, u = -(p = Math.min(f / 2 - d / 2, 0)), v = -(c = Math.min(m / 2 - h / 2, 0)), (r = s * g.scale) < p && (r = p), r > u && (r = u), (n = a * g.scale) < c && (n = c), n > v && (n = v)) : (r = 0, n = 0), w.$imageWrapEl.transition(300).transform("translate3d(" + r + "px, " + n + "px,0)"), w.$imageEl.transition(300).transform("translate3d(0,0,0) scale(" + g.scale + ")"))
      },
      out: function () {
        var e = this.zoom,
          t = this.params.zoom,
          i = e.gesture;
        i.$slideEl || (i.$slideEl = this.slides.eq(this.activeIndex), i.$imageEl = i.$slideEl.find("img, svg, canvas, picture, .swiper-zoom-target"), i.$imageWrapEl = i.$imageEl.parent("." + t.containerClass)), i.$imageEl && 0 !== i.$imageEl.length && (e.scale = 1, e.currentScale = 1, i.$imageWrapEl.transition(300).transform("translate3d(0,0,0)"), i.$imageEl.transition(300).transform("translate3d(0,0,0) scale(1)"), i.$slideEl.removeClass("" + t.zoomedSlideClass), i.$slideEl = void 0)
      },
      enable: function () {
        var e = this.zoom;
        if (!e.enabled) {
          e.enabled = !0;
          var t = !("touchstart" !== this.touchEvents.start || !o.passiveListener || !this.params.passiveListeners) && {
            passive: !0,
            capture: !1
          },
            i = !o.passiveListener || {
              passive: !1,
              capture: !0
            },
            s = "." + this.params.slideClass;
          o.gestures ? (this.$wrapperEl.on("gesturestart", s, e.onGestureStart, t), this.$wrapperEl.on("gesturechange", s, e.onGestureChange, t), this.$wrapperEl.on("gestureend", s, e.onGestureEnd, t)) : "touchstart" === this.touchEvents.start && (this.$wrapperEl.on(this.touchEvents.start, s, e.onGestureStart, t), this.$wrapperEl.on(this.touchEvents.move, s, e.onGestureChange, i), this.$wrapperEl.on(this.touchEvents.end, s, e.onGestureEnd, t), this.touchEvents.cancel && this.$wrapperEl.on(this.touchEvents.cancel, s, e.onGestureEnd, t)), this.$wrapperEl.on(this.touchEvents.move, "." + this.params.zoom.containerClass, e.onTouchMove, i)
        }
      },
      disable: function () {
        var e = this.zoom;
        if (e.enabled) {
          this.zoom.enabled = !1;
          var t = !("touchstart" !== this.touchEvents.start || !o.passiveListener || !this.params.passiveListeners) && {
            passive: !0,
            capture: !1
          },
            i = !o.passiveListener || {
              passive: !1,
              capture: !0
            },
            s = "." + this.params.slideClass;
          o.gestures ? (this.$wrapperEl.off("gesturestart", s, e.onGestureStart, t), this.$wrapperEl.off("gesturechange", s, e.onGestureChange, t), this.$wrapperEl.off("gestureend", s, e.onGestureEnd, t)) : "touchstart" === this.touchEvents.start && (this.$wrapperEl.off(this.touchEvents.start, s, e.onGestureStart, t), this.$wrapperEl.off(this.touchEvents.move, s, e.onGestureChange, i), this.$wrapperEl.off(this.touchEvents.end, s, e.onGestureEnd, t), this.touchEvents.cancel && this.$wrapperEl.off(this.touchEvents.cancel, s, e.onGestureEnd, t)), this.$wrapperEl.off(this.touchEvents.move, "." + this.params.zoom.containerClass, e.onTouchMove, i)
        }
      }
    },
    le = {
      loadInSlide: function (e, t) {
        void 0 === t && (t = !0);
        var i = this,
          a = i.params.lazy;
        if (void 0 !== e && 0 !== i.slides.length) {
          var r = i.virtual && i.params.virtual.enabled ? i.$wrapperEl.children("." + i.params.slideClass + '[data-swiper-slide-index="' + e + '"]') : i.slides.eq(e),
            n = r.find("." + a.elementClass + ":not(." + a.loadedClass + "):not(." + a.loadingClass + ")");
          !r.hasClass(a.elementClass) || r.hasClass(a.loadedClass) || r.hasClass(a.loadingClass) || (n = n.add(r[0])), 0 !== n.length && n.each((function (e, n) {
            var o = s(n);
            o.addClass(a.loadingClass);
            var l = o.attr("data-background"),
              d = o.attr("data-src"),
              h = o.attr("data-srcset"),
              p = o.attr("data-sizes");
            i.loadImage(o[0], d || l, h, p, !1, (function () {
              if (null != i && i && (!i || i.params) && !i.destroyed) {
                if (l ? (o.css("background-image", 'url("' + l + '")'), o.removeAttr("data-background")) : (h && (o.attr("srcset", h), o.removeAttr("data-srcset")), p && (o.attr("sizes", p), o.removeAttr("data-sizes")), d && (o.attr("src", d), o.removeAttr("data-src"))), o.addClass(a.loadedClass).removeClass(a.loadingClass), r.find("." + a.preloaderClass).remove(), i.params.loop && t) {
                  var e = r.attr("data-swiper-slide-index");
                  if (r.hasClass(i.params.slideDuplicateClass)) {
                    var s = i.$wrapperEl.children('[data-swiper-slide-index="' + e + '"]:not(.' + i.params.slideDuplicateClass + ")");
                    i.lazy.loadInSlide(s.index(), !1)
                  } else {
                    var n = i.$wrapperEl.children("." + i.params.slideDuplicateClass + '[data-swiper-slide-index="' + e + '"]');
                    i.lazy.loadInSlide(n.index(), !1)
                  }
                }
                i.emit("lazyImageReady", r[0], o[0]), i.params.autoHeight && i.updateAutoHeight()
              }
            })), i.emit("lazyImageLoad", r[0], o[0])
          }))
        }
      },
      load: function () {
        var e = this,
          t = e.$wrapperEl,
          i = e.params,
          a = e.slides,
          r = e.activeIndex,
          n = e.virtual && i.virtual.enabled,
          o = i.lazy,
          l = i.slidesPerView;

        function d(e) {
          if (n) {
            if (t.children("." + i.slideClass + '[data-swiper-slide-index="' + e + '"]').length) return !0
          } else if (a[e]) return !0;
          return !1
        }

        function h(e) {
          return n ? s(e).attr("data-swiper-slide-index") : s(e).index()
        }
        if ("auto" === l && (l = 0), e.lazy.initialImageLoaded || (e.lazy.initialImageLoaded = !0), e.params.watchSlidesVisibility) t.children("." + i.slideVisibleClass).each((function (t, i) {
          var a = n ? s(i).attr("data-swiper-slide-index") : s(i).index();
          e.lazy.loadInSlide(a)
        }));
        else if (l > 1)
          for (var p = r; p < r + l; p += 1) d(p) && e.lazy.loadInSlide(p);
        else e.lazy.loadInSlide(r);
        if (o.loadPrevNext)
          if (l > 1 || o.loadPrevNextAmount && o.loadPrevNextAmount > 1) {
            for (var c = o.loadPrevNextAmount, u = l, v = Math.min(r + u + Math.max(c, u), a.length), f = Math.max(r - Math.max(u, c), 0), m = r + l; m < v; m += 1) d(m) && e.lazy.loadInSlide(m);
            for (var g = f; g < r; g += 1) d(g) && e.lazy.loadInSlide(g)
          } else {
            var b = t.children("." + i.slideNextClass);
            b.length > 0 && e.lazy.loadInSlide(h(b));
            var w = t.children("." + i.slidePrevClass);
            w.length > 0 && e.lazy.loadInSlide(h(w))
          }
      }
    },
    de = {
      LinearSpline: function (e, t) {
        var i, s, a, r, n, o = function (e, t) {
          for (s = -1, i = e.length; i - s > 1;) e[a = i + s >> 1] <= t ? s = a : i = a;
          return i
        };
        return this.x = e, this.y = t, this.lastIndex = e.length - 1, this.interpolate = function (e) {
          return e ? (n = o(this.x, e), r = n - 1, (e - this.x[r]) * (this.y[n] - this.y[r]) / (this.x[n] - this.x[r]) + this.y[r]) : 0
        }, this
      },
      getInterpolateFunction: function (e) {
        this.controller.spline || (this.controller.spline = this.params.loop ? new de.LinearSpline(this.slidesGrid, e.slidesGrid) : new de.LinearSpline(this.snapGrid, e.snapGrid))
      },
      setTranslate: function (e, t) {
        var i, s, a = this,
          r = a.controller.control;

        function n(e) {
          var t = a.rtlTranslate ? -a.translate : a.translate;
          "slide" === a.params.controller.by && (a.controller.getInterpolateFunction(e), s = -a.controller.spline.interpolate(-t)), s && "container" !== a.params.controller.by || (i = (e.maxTranslate() - e.minTranslate()) / (a.maxTranslate() - a.minTranslate()), s = (t - a.minTranslate()) * i + e.minTranslate()), a.params.controller.inverse && (s = e.maxTranslate() - s), e.updateProgress(s), e.setTranslate(s, a), e.updateActiveIndex(), e.updateSlidesClasses()
        }
        if (Array.isArray(r))
          for (var o = 0; o < r.length; o += 1) r[o] !== t && r[o] instanceof W && n(r[o]);
        else r instanceof W && t !== r && n(r)
      },
      setTransition: function (e, t) {
        var i, s = this,
          a = s.controller.control;

        function r(t) {
          t.setTransition(e, s), 0 !== e && (t.transitionStart(), t.params.autoHeight && n.nextTick((function () {
            t.updateAutoHeight()
          })), t.$wrapperEl.transitionEnd((function () {
            a && (t.params.loop && "slide" === s.params.controller.by && t.loopFix(), t.transitionEnd())
          })))
        }
        if (Array.isArray(a))
          for (i = 0; i < a.length; i += 1) a[i] !== t && a[i] instanceof W && r(a[i]);
        else a instanceof W && t !== a && r(a)
      }
    },
    he = {
      makeElFocusable: function (e) {
        return e.attr("tabIndex", "0"), e
      },
      addElRole: function (e, t) {
        return e.attr("role", t), e
      },
      addElLabel: function (e, t) {
        return e.attr("aria-label", t), e
      },
      disableEl: function (e) {
        return e.attr("aria-disabled", !0), e
      },
      enableEl: function (e) {
        return e.attr("aria-disabled", !1), e
      },
      onEnterKey: function (e) {
        var t = this.params.a11y;
        if (13 === e.keyCode) {
          var i = s(e.target);
          this.navigation && this.navigation.$nextEl && i.is(this.navigation.$nextEl) && (this.isEnd && !this.params.loop || this.slideNext(), this.isEnd ? this.a11y.notify(t.lastSlideMessage) : this.a11y.notify(t.nextSlideMessage)), this.navigation && this.navigation.$prevEl && i.is(this.navigation.$prevEl) && (this.isBeginning && !this.params.loop || this.slidePrev(), this.isBeginning ? this.a11y.notify(t.firstSlideMessage) : this.a11y.notify(t.prevSlideMessage)), this.pagination && i.is("." + this.params.pagination.bulletClass) && i[0].click()
        }
      },
      notify: function (e) {
        var t = this.a11y.liveRegion;
        0 !== t.length && (t.html(""), t.html(e))
      },
      updateNavigation: function () {
        if (!this.params.loop && this.navigation) {
          var e = this.navigation,
            t = e.$nextEl,
            i = e.$prevEl;
          i && i.length > 0 && (this.isBeginning ? this.a11y.disableEl(i) : this.a11y.enableEl(i)), t && t.length > 0 && (this.isEnd ? this.a11y.disableEl(t) : this.a11y.enableEl(t))
        }
      },
      updatePagination: function () {
        var e = this,
          t = e.params.a11y;
        e.pagination && e.params.pagination.clickable && e.pagination.bullets && e.pagination.bullets.length && e.pagination.bullets.each((function (i, a) {
          var r = s(a);
          e.a11y.makeElFocusable(r), e.a11y.addElRole(r, "button"), e.a11y.addElLabel(r, t.paginationBulletMessage.replace(/{{index}}/, r.index() + 1))
        }))
      },
      init: function () {
        this.$el.append(this.a11y.liveRegion);
        var e, t, i = this.params.a11y;
        this.navigation && this.navigation.$nextEl && (e = this.navigation.$nextEl), this.navigation && this.navigation.$prevEl && (t = this.navigation.$prevEl), e && (this.a11y.makeElFocusable(e), this.a11y.addElRole(e, "button"), this.a11y.addElLabel(e, i.nextSlideMessage), e.on("keydown", this.a11y.onEnterKey)), t && (this.a11y.makeElFocusable(t), this.a11y.addElRole(t, "button"), this.a11y.addElLabel(t, i.prevSlideMessage), t.on("keydown", this.a11y.onEnterKey)), this.pagination && this.params.pagination.clickable && this.pagination.bullets && this.pagination.bullets.length && this.pagination.$el.on("keydown", "." + this.params.pagination.bulletClass, this.a11y.onEnterKey)
      },
      destroy: function () {
        var e, t;
        this.a11y.liveRegion && this.a11y.liveRegion.length > 0 && this.a11y.liveRegion.remove(), this.navigation && this.navigation.$nextEl && (e = this.navigation.$nextEl), this.navigation && this.navigation.$prevEl && (t = this.navigation.$prevEl), e && e.off("keydown", this.a11y.onEnterKey), t && t.off("keydown", this.a11y.onEnterKey), this.pagination && this.params.pagination.clickable && this.pagination.bullets && this.pagination.bullets.length && this.pagination.$el.off("keydown", "." + this.params.pagination.bulletClass, this.a11y.onEnterKey)
      }
    },
    pe = {
      init: function () {
        if (this.params.history) {
          if (!t.history || !t.history.pushState) return this.params.history.enabled = !1, void (this.params.hashNavigation.enabled = !0);
          var e = this.history;
          e.initialized = !0, e.paths = pe.getPathValues(), (e.paths.key || e.paths.value) && (e.scrollToSlide(0, e.paths.value, this.params.runCallbacksOnInit), this.params.history.replaceState || t.addEventListener("popstate", this.history.setHistoryPopState))
        }
      },
      destroy: function () {
        this.params.history.replaceState || t.removeEventListener("popstate", this.history.setHistoryPopState)
      },
      setHistoryPopState: function () {
        this.history.paths = pe.getPathValues(), this.history.scrollToSlide(this.params.speed, this.history.paths.value, !1)
      },
      getPathValues: function () {
        var e = t.location.pathname.slice(1).split("/").filter((function (e) {
          return "" !== e
        })),
          i = e.length;
        return {
          key: e[i - 2],
          value: e[i - 1]
        }
      },
      setHistory: function (e, i) {
        if (this.history.initialized && this.params.history.enabled) {
          var s = this.slides.eq(i),
            a = pe.slugify(s.attr("data-history"));
          t.location.pathname.includes(e) || (a = e + "/" + a);
          var r = t.history.state;
          r && r.value === a || (this.params.history.replaceState ? t.history.replaceState({
            value: a
          }, null, a) : t.history.pushState({
            value: a
          }, null, a))
        }
      },
      slugify: function (e) {
        return e.toString().replace(/\s+/g, "-").replace(/[^\w-]+/g, "").replace(/--+/g, "-").replace(/^-+/, "").replace(/-+$/, "")
      },
      scrollToSlide: function (e, t, i) {
        if (t)
          for (var s = 0, a = this.slides.length; s < a; s += 1) {
            var r = this.slides.eq(s);
            if (pe.slugify(r.attr("data-history")) === t && !r.hasClass(this.params.slideDuplicateClass)) {
              var n = r.index();
              this.slideTo(n, e, i)
            }
          } else this.slideTo(0, e, i)
      }
    },
    ce = {
      onHashCange: function () {
        var t = e.location.hash.replace("#", "");
        if (t !== this.slides.eq(this.activeIndex).attr("data-hash")) {
          var i = this.$wrapperEl.children("." + this.params.slideClass + '[data-hash="' + t + '"]').index();
          if (void 0 === i) return;
          this.slideTo(i)
        }
      },
      setHash: function () {
        if (this.hashNavigation.initialized && this.params.hashNavigation.enabled)
          if (this.params.hashNavigation.replaceState && t.history && t.history.replaceState) t.history.replaceState(null, null, "#" + this.slides.eq(this.activeIndex).attr("data-hash") || "");
          else {
            var i = this.slides.eq(this.activeIndex),
              s = i.attr("data-hash") || i.attr("data-history");
            e.location.hash = s || ""
          }
      },
      init: function () {
        if (!(!this.params.hashNavigation.enabled || this.params.history && this.params.history.enabled)) {
          this.hashNavigation.initialized = !0;
          var i = e.location.hash.replace("#", "");
          if (i)
            for (var a = 0, r = this.slides.length; a < r; a += 1) {
              var n = this.slides.eq(a);
              if ((n.attr("data-hash") || n.attr("data-history")) === i && !n.hasClass(this.params.slideDuplicateClass)) {
                var o = n.index();
                this.slideTo(o, 0, this.params.runCallbacksOnInit, !0)
              }
            }
          this.params.hashNavigation.watchState && s(t).on("hashchange", this.hashNavigation.onHashCange)
        }
      },
      destroy: function () {
        this.params.hashNavigation.watchState && s(t).off("hashchange", this.hashNavigation.onHashCange)
      }
    },
    ue = {
      run: function () {
        var e = this,
          t = e.slides.eq(e.activeIndex),
          i = e.params.autoplay.delay;
        t.attr("data-swiper-autoplay") && (i = t.attr("data-swiper-autoplay") || e.params.autoplay.delay), clearTimeout(e.autoplay.timeout), e.autoplay.timeout = n.nextTick((function () {
          e.params.autoplay.reverseDirection ? e.params.loop ? (e.loopFix(), e.slidePrev(e.params.speed, !0, !0), e.emit("autoplay")) : e.isBeginning ? e.params.autoplay.stopOnLastSlide ? e.autoplay.stop() : (e.slideTo(e.slides.length - 1, e.params.speed, !0, !0), e.emit("autoplay")) : (e.slidePrev(e.params.speed, !0, !0), e.emit("autoplay")) : e.params.loop ? (e.loopFix(), e.slideNext(e.params.speed, !0, !0), e.emit("autoplay")) : e.isEnd ? e.params.autoplay.stopOnLastSlide ? e.autoplay.stop() : (e.slideTo(0, e.params.speed, !0, !0), e.emit("autoplay")) : (e.slideNext(e.params.speed, !0, !0), e.emit("autoplay")), e.params.cssMode && e.autoplay.running && e.autoplay.run()
        }), i)
      },
      start: function () {
        return void 0 === this.autoplay.timeout && (!this.autoplay.running && (this.autoplay.running = !0, this.emit("autoplayStart"), this.autoplay.run(), !0))
      },
      stop: function () {
        return !!this.autoplay.running && (void 0 !== this.autoplay.timeout && (this.autoplay.timeout && (clearTimeout(this.autoplay.timeout), this.autoplay.timeout = void 0), this.autoplay.running = !1, this.emit("autoplayStop"), !0))
      },
      pause: function (e) {
        this.autoplay.running && (this.autoplay.paused || (this.autoplay.timeout && clearTimeout(this.autoplay.timeout), this.autoplay.paused = !0, 0 !== e && this.params.autoplay.waitForTransition ? (this.$wrapperEl[0].addEventListener("transitionend", this.autoplay.onTransitionEnd), this.$wrapperEl[0].addEventListener("webkitTransitionEnd", this.autoplay.onTransitionEnd)) : (this.autoplay.paused = !1, this.autoplay.run())))
      }
    },
    ve = {
      setTranslate: function () {
        for (var e = this.slides, t = 0; t < e.length; t += 1) {
          var i = this.slides.eq(t),
            s = -i[0].swiperSlideOffset;
          this.params.virtualTranslate || (s -= this.translate);
          var a = 0;
          this.isHorizontal() || (a = s, s = 0);
          var r = this.params.fadeEffect.crossFade ? Math.max(1 - Math.abs(i[0].progress), 0) : 1 + Math.min(Math.max(i[0].progress, -1), 0);
          i.css({
            opacity: r
          }).transform("translate3d(" + s + "px, " + a + "px, 0px)")
        }
      },
      setTransition: function (e) {
        var t = this,
          i = t.slides,
          s = t.$wrapperEl;
        if (i.transition(e), t.params.virtualTranslate && 0 !== e) {
          var a = !1;
          i.transitionEnd((function () {
            if (!a && t && !t.destroyed) {
              a = !0, t.animating = !1;
              for (var e = ["webkitTransitionEnd", "transitionend"], i = 0; i < e.length; i += 1) s.trigger(e[i])
            }
          }))
        }
      }
    },
    fe = {
      setTranslate: function () {
        var e, t = this.$el,
          i = this.$wrapperEl,
          a = this.slides,
          r = this.width,
          n = this.height,
          o = this.rtlTranslate,
          l = this.size,
          d = this.params.cubeEffect,
          h = this.isHorizontal(),
          p = this.virtual && this.params.virtual.enabled,
          c = 0;
        d.shadow && (h ? (0 === (e = i.find(".swiper-cube-shadow")).length && (e = s('<div class="swiper-cube-shadow"></div>'), i.append(e)), e.css({
          height: r + "px"
        })) : 0 === (e = t.find(".swiper-cube-shadow")).length && (e = s('<div class="swiper-cube-shadow"></div>'), t.append(e)));
        for (var u = 0; u < a.length; u += 1) {
          var v = a.eq(u),
            f = u;
          p && (f = parseInt(v.attr("data-swiper-slide-index"), 10));
          var m = 90 * f,
            g = Math.floor(m / 360);
          o && (m = -m, g = Math.floor(-m / 360));
          var b = Math.max(Math.min(v[0].progress, 1), -1),
            w = 0,
            y = 0,
            x = 0;
          f % 4 == 0 ? (w = 4 * -g * l, x = 0) : (f - 1) % 4 == 0 ? (w = 0, x = 4 * -g * l) : (f - 2) % 4 == 0 ? (w = l + 4 * g * l, x = l) : (f - 3) % 4 == 0 && (w = -l, x = 3 * l + 4 * l * g), o && (w = -w), h || (y = w, w = 0);
          var T = "rotateX(" + (h ? 0 : -m) + "deg) rotateY(" + (h ? m : 0) + "deg) translate3d(" + w + "px, " + y + "px, " + x + "px)";
          if (b <= 1 && b > -1 && (c = 90 * f + 90 * b, o && (c = 90 * -f - 90 * b)), v.transform(T), d.slideShadows) {
            var E = h ? v.find(".swiper-slide-shadow-left") : v.find(".swiper-slide-shadow-top"),
              S = h ? v.find(".swiper-slide-shadow-right") : v.find(".swiper-slide-shadow-bottom");
            0 === E.length && (E = s('<div class="swiper-slide-shadow-' + (h ? "left" : "top") + '"></div>'), v.append(E)), 0 === S.length && (S = s('<div class="swiper-slide-shadow-' + (h ? "right" : "bottom") + '"></div>'), v.append(S)), E.length && (E[0].style.opacity = Math.max(-b, 0)), S.length && (S[0].style.opacity = Math.max(b, 0))
          }
        }
        if (i.css({
          "-webkit-transform-origin": "50% 50% -" + l / 2 + "px",
          "-moz-transform-origin": "50% 50% -" + l / 2 + "px",
          "-ms-transform-origin": "50% 50% -" + l / 2 + "px",
          "transform-origin": "50% 50% -" + l / 2 + "px"
        }), d.shadow)
          if (h) e.transform("translate3d(0px, " + (r / 2 + d.shadowOffset) + "px, " + -r / 2 + "px) rotateX(90deg) rotateZ(0deg) scale(" + d.shadowScale + ")");
          else {
            var C = Math.abs(c) - 90 * Math.floor(Math.abs(c) / 90),
              M = 1.5 - (Math.sin(2 * C * Math.PI / 360) / 2 + Math.cos(2 * C * Math.PI / 360) / 2),
              P = d.shadowScale,
              z = d.shadowScale / M,
              k = d.shadowOffset;
            e.transform("scale3d(" + P + ", 1, " + z + ") translate3d(0px, " + (n / 2 + k) + "px, " + -n / 2 / z + "px) rotateX(-90deg)")
          }
        var $ = j.isSafari || j.isUiWebView ? -l / 2 : 0;
        i.transform("translate3d(0px,0," + $ + "px) rotateX(" + (this.isHorizontal() ? 0 : c) + "deg) rotateY(" + (this.isHorizontal() ? -c : 0) + "deg)")
      },
      setTransition: function (e) {
        var t = this.$el;
        this.slides.transition(e).find(".swiper-slide-shadow-top, .swiper-slide-shadow-right, .swiper-slide-shadow-bottom, .swiper-slide-shadow-left").transition(e), this.params.cubeEffect.shadow && !this.isHorizontal() && t.find(".swiper-cube-shadow").transition(e)
      }
    },
    me = {
      setTranslate: function () {
        for (var e = this.slides, t = this.rtlTranslate, i = 0; i < e.length; i += 1) {
          var a = e.eq(i),
            r = a[0].progress;
          this.params.flipEffect.limitRotation && (r = Math.max(Math.min(a[0].progress, 1), -1));
          var n = -180 * r,
            o = 0,
            l = -a[0].swiperSlideOffset,
            d = 0;
          if (this.isHorizontal() ? t && (n = -n) : (d = l, l = 0, o = -n, n = 0), a[0].style.zIndex = -Math.abs(Math.round(r)) + e.length, this.params.flipEffect.slideShadows) {
            var h = this.isHorizontal() ? a.find(".swiper-slide-shadow-left") : a.find(".swiper-slide-shadow-top"),
              p = this.isHorizontal() ? a.find(".swiper-slide-shadow-right") : a.find(".swiper-slide-shadow-bottom");
            0 === h.length && (h = s('<div class="swiper-slide-shadow-' + (this.isHorizontal() ? "left" : "top") + '"></div>'), a.append(h)), 0 === p.length && (p = s('<div class="swiper-slide-shadow-' + (this.isHorizontal() ? "right" : "bottom") + '"></div>'), a.append(p)), h.length && (h[0].style.opacity = Math.max(-r, 0)), p.length && (p[0].style.opacity = Math.max(r, 0))
          }
          a.transform("translate3d(" + l + "px, " + d + "px, 0px) rotateX(" + o + "deg) rotateY(" + n + "deg)")
        }
      },
      setTransition: function (e) {
        var t = this,
          i = t.slides,
          s = t.activeIndex,
          a = t.$wrapperEl;
        if (i.transition(e).find(".swiper-slide-shadow-top, .swiper-slide-shadow-right, .swiper-slide-shadow-bottom, .swiper-slide-shadow-left").transition(e), t.params.virtualTranslate && 0 !== e) {
          var r = !1;
          i.eq(s).transitionEnd((function () {
            if (!r && t && !t.destroyed) {
              r = !0, t.animating = !1;
              for (var e = ["webkitTransitionEnd", "transitionend"], i = 0; i < e.length; i += 1) a.trigger(e[i])
            }
          }))
        }
      }
    },
    ge = {
      setTranslate: function () {
        for (var e = this.width, t = this.height, i = this.slides, a = this.$wrapperEl, r = this.slidesSizesGrid, n = this.params.coverflowEffect, l = this.isHorizontal(), d = this.translate, h = l ? e / 2 - d : t / 2 - d, p = l ? n.rotate : -n.rotate, c = n.depth, u = 0, v = i.length; u < v; u += 1) {
          var f = i.eq(u),
            m = r[u],
            g = (h - f[0].swiperSlideOffset - m / 2) / m * n.modifier,
            b = l ? p * g : 0,
            w = l ? 0 : p * g,
            y = -c * Math.abs(g),
            x = n.stretch;
          "string" == typeof x && -1 !== x.indexOf("%") && (x = parseFloat(n.stretch) / 100 * m);
          var T = l ? 0 : x * g,
            E = l ? x * g : 0;
          Math.abs(E) < .001 && (E = 0), Math.abs(T) < .001 && (T = 0), Math.abs(y) < .001 && (y = 0), Math.abs(b) < .001 && (b = 0), Math.abs(w) < .001 && (w = 0);
          var S = "translate3d(" + E + "px," + T + "px," + y + "px)  rotateX(" + w + "deg) rotateY(" + b + "deg)";
          if (f.transform(S), f[0].style.zIndex = 1 - Math.abs(Math.round(g)), n.slideShadows) {
            var C = l ? f.find(".swiper-slide-shadow-left") : f.find(".swiper-slide-shadow-top"),
              M = l ? f.find(".swiper-slide-shadow-right") : f.find(".swiper-slide-shadow-bottom");
            0 === C.length && (C = s('<div class="swiper-slide-shadow-' + (l ? "left" : "top") + '"></div>'), f.append(C)), 0 === M.length && (M = s('<div class="swiper-slide-shadow-' + (l ? "right" : "bottom") + '"></div>'), f.append(M)), C.length && (C[0].style.opacity = g > 0 ? g : 0), M.length && (M[0].style.opacity = -g > 0 ? -g : 0)
          }
        } (o.pointerEvents || o.prefixedPointerEvents) && (a[0].style.perspectiveOrigin = h + "px 50%")
      },
      setTransition: function (e) {
        this.slides.transition(e).find(".swiper-slide-shadow-top, .swiper-slide-shadow-right, .swiper-slide-shadow-bottom, .swiper-slide-shadow-left").transition(e)
      }
    },
    be = {
      init: function () {
        var e = this.params.thumbs,
          t = this.constructor;
        e.swiper instanceof t ? (this.thumbs.swiper = e.swiper, n.extend(this.thumbs.swiper.originalParams, {
          watchSlidesProgress: !0,
          slideToClickedSlide: !1
        }), n.extend(this.thumbs.swiper.params, {
          watchSlidesProgress: !0,
          slideToClickedSlide: !1
        })) : n.isObject(e.swiper) && (this.thumbs.swiper = new t(n.extend({}, e.swiper, {
          watchSlidesVisibility: !0,
          watchSlidesProgress: !0,
          slideToClickedSlide: !1
        })), this.thumbs.swiperCreated = !0), this.thumbs.swiper.$el.addClass(this.params.thumbs.thumbsContainerClass), this.thumbs.swiper.on("tap", this.thumbs.onThumbClick)
      },
      onThumbClick: function () {
        var e = this.thumbs.swiper;
        if (e) {
          var t = e.clickedIndex,
            i = e.clickedSlide;
          if (!(i && s(i).hasClass(this.params.thumbs.slideThumbActiveClass) || null == t)) {
            var a;
            if (a = e.params.loop ? parseInt(s(e.clickedSlide).attr("data-swiper-slide-index"), 10) : t, this.params.loop) {
              var r = this.activeIndex;
              this.slides.eq(r).hasClass(this.params.slideDuplicateClass) && (this.loopFix(), this._clientLeft = this.$wrapperEl[0].clientLeft, r = this.activeIndex);
              var n = this.slides.eq(r).prevAll('[data-swiper-slide-index="' + a + '"]').eq(0).index(),
                o = this.slides.eq(r).nextAll('[data-swiper-slide-index="' + a + '"]').eq(0).index();
              a = void 0 === n ? o : void 0 === o ? n : o - r < r - n ? o : n
            }
            this.slideTo(a)
          }
        }
      },
      update: function (e) {
        var t = this.thumbs.swiper;
        if (t) {
          var i = "auto" === t.params.slidesPerView ? t.slidesPerViewDynamic() : t.params.slidesPerView;
          if (this.realIndex !== t.realIndex) {
            var s, a = t.activeIndex;
            if (t.params.loop) {
              t.slides.eq(a).hasClass(t.params.slideDuplicateClass) && (t.loopFix(), t._clientLeft = t.$wrapperEl[0].clientLeft, a = t.activeIndex);
              var r = t.slides.eq(a).prevAll('[data-swiper-slide-index="' + this.realIndex + '"]').eq(0).index(),
                n = t.slides.eq(a).nextAll('[data-swiper-slide-index="' + this.realIndex + '"]').eq(0).index();
              s = void 0 === r ? n : void 0 === n ? r : n - a == a - r ? a : n - a < a - r ? n : r
            } else s = this.realIndex;
            t.visibleSlidesIndexes && t.visibleSlidesIndexes.indexOf(s) < 0 && (t.params.centeredSlides ? s = s > a ? s - Math.floor(i / 2) + 1 : s + Math.floor(i / 2) - 1 : s > a && (s = s - i + 1), t.slideTo(s, e ? 0 : void 0))
          }
          var o = 1,
            l = this.params.thumbs.slideThumbActiveClass;
          if (this.params.slidesPerView > 1 && !this.params.centeredSlides && (o = this.params.slidesPerView), this.params.thumbs.multipleActiveThumbs || (o = 1), o = Math.floor(o), t.slides.removeClass(l), t.params.loop || t.params.virtual && t.params.virtual.enabled)
            for (var d = 0; d < o; d += 1) t.$wrapperEl.children('[data-swiper-slide-index="' + (this.realIndex + d) + '"]').addClass(l);
          else
            for (var h = 0; h < o; h += 1) t.slides.eq(this.realIndex + h).addClass(l)
        }
      }
    },
    we = [R, q, K, U, Z, J, te, {
      name: "mousewheel",
      params: {
        mousewheel: {
          enabled: !1,
          releaseOnEdges: !1,
          invert: !1,
          forceToAxis: !1,
          sensitivity: 1,
          eventsTarged: "container"
        }
      },
      create: function () {
        n.extend(this, {
          mousewheel: {
            enabled: !1,
            enable: ie.enable.bind(this),
            disable: ie.disable.bind(this),
            handle: ie.handle.bind(this),
            handleMouseEnter: ie.handleMouseEnter.bind(this),
            handleMouseLeave: ie.handleMouseLeave.bind(this),
            animateSlider: ie.animateSlider.bind(this),
            releaseScroll: ie.releaseScroll.bind(this),
            lastScrollTime: n.now(),
            lastEventBeforeSnap: void 0,
            recentWheelEvents: []
          }
        })
      },
      on: {
        init: function () {
          !this.params.mousewheel.enabled && this.params.cssMode && this.mousewheel.disable(), this.params.mousewheel.enabled && this.mousewheel.enable()
        },
        destroy: function () {
          this.params.cssMode && this.mousewheel.enable(), this.mousewheel.enabled && this.mousewheel.disable()
        }
      }
    }, {
        name: "navigation",
        params: {
          navigation: {
            nextEl: null,
            prevEl: null,
            hideOnClick: !1,
            disabledClass: "swiper-button-disabled",
            hiddenClass: "swiper-button-hidden",
            lockClass: "swiper-button-lock"
          }
        },
        create: function () {
          n.extend(this, {
            navigation: {
              init: se.init.bind(this),
              update: se.update.bind(this),
              destroy: se.destroy.bind(this),
              onNextClick: se.onNextClick.bind(this),
              onPrevClick: se.onPrevClick.bind(this)
            }
          })
        },
        on: {
          init: function () {
            this.navigation.init(), this.navigation.update()
          },
          toEdge: function () {
            this.navigation.update()
          },
          fromEdge: function () {
            this.navigation.update()
          },
          destroy: function () {
            this.navigation.destroy()
          },
          click: function (e) {
            var t, i = this.navigation,
              a = i.$nextEl,
              r = i.$prevEl;
            !this.params.navigation.hideOnClick || s(e.target).is(r) || s(e.target).is(a) || (a ? t = a.hasClass(this.params.navigation.hiddenClass) : r && (t = r.hasClass(this.params.navigation.hiddenClass)), !0 === t ? this.emit("navigationShow", this) : this.emit("navigationHide", this), a && a.toggleClass(this.params.navigation.hiddenClass), r && r.toggleClass(this.params.navigation.hiddenClass))
          }
        }
      }, {
        name: "pagination",
        params: {
          pagination: {
            el: null,
            bulletElement: "span",
            clickable: !1,
            hideOnClick: !1,
            renderBullet: null,
            renderProgressbar: null,
            renderFraction: null,
            renderCustom: null,
            progressbarOpposite: !1,
            type: "bullets",
            dynamicBullets: !1,
            dynamicMainBullets: 1,
            formatFractionCurrent: function (e) {
              return e
            },
            formatFractionTotal: function (e) {
              return e
            },
            bulletClass: "swiper-pagination-bullet",
            bulletActiveClass: "swiper-pagination-bullet-active",
            modifierClass: "swiper-pagination-",
            currentClass: "swiper-pagination-current",
            totalClass: "swiper-pagination-total",
            hiddenClass: "swiper-pagination-hidden",
            progressbarFillClass: "swiper-pagination-progressbar-fill",
            progressbarOppositeClass: "swiper-pagination-progressbar-opposite",
            clickableClass: "swiper-pagination-clickable",
            lockClass: "swiper-pagination-lock"
          }
        },
        create: function () {
          n.extend(this, {
            pagination: {
              init: ae.init.bind(this),
              render: ae.render.bind(this),
              update: ae.update.bind(this),
              destroy: ae.destroy.bind(this),
              dynamicBulletIndex: 0
            }
          })
        },
        on: {
          init: function () {
            this.pagination.init(), this.pagination.render(), this.pagination.update()
          },
          activeIndexChange: function () {
            this.params.loop ? this.pagination.update() : void 0 === this.snapIndex && this.pagination.update()
          },
          snapIndexChange: function () {
            this.params.loop || this.pagination.update()
          },
          slidesLengthChange: function () {
            this.params.loop && (this.pagination.render(), this.pagination.update())
          },
          snapGridLengthChange: function () {
            this.params.loop || (this.pagination.render(), this.pagination.update())
          },
          destroy: function () {
            this.pagination.destroy()
          },
          click: function (e) {
            this.params.pagination.el && this.params.pagination.hideOnClick && this.pagination.$el.length > 0 && !s(e.target).hasClass(this.params.pagination.bulletClass) && (!0 === this.pagination.$el.hasClass(this.params.pagination.hiddenClass) ? this.emit("paginationShow", this) : this.emit("paginationHide", this), this.pagination.$el.toggleClass(this.params.pagination.hiddenClass))
          }
        }
      }, {
        name: "scrollbar",
        params: {
          scrollbar: {
            el: null,
            dragSize: "auto",
            hide: !1,
            draggable: !1,
            snapOnRelease: !0,
            lockClass: "swiper-scrollbar-lock",
            dragClass: "swiper-scrollbar-drag"
          }
        },
        create: function () {
          n.extend(this, {
            scrollbar: {
              init: re.init.bind(this),
              destroy: re.destroy.bind(this),
              updateSize: re.updateSize.bind(this),
              setTranslate: re.setTranslate.bind(this),
              setTransition: re.setTransition.bind(this),
              enableDraggable: re.enableDraggable.bind(this),
              disableDraggable: re.disableDraggable.bind(this),
              setDragPosition: re.setDragPosition.bind(this),
              getPointerPosition: re.getPointerPosition.bind(this),
              onDragStart: re.onDragStart.bind(this),
              onDragMove: re.onDragMove.bind(this),
              onDragEnd: re.onDragEnd.bind(this),
              isTouched: !1,
              timeout: null,
              dragTimeout: null
            }
          })
        },
        on: {
          init: function () {
            this.scrollbar.init(), this.scrollbar.updateSize(), this.scrollbar.setTranslate()
          },
          update: function () {
            this.scrollbar.updateSize()
          },
          resize: function () {
            this.scrollbar.updateSize()
          },
          observerUpdate: function () {
            this.scrollbar.updateSize()
          },
          setTranslate: function () {
            this.scrollbar.setTranslate()
          },
          setTransition: function (e) {
            this.scrollbar.setTransition(e)
          },
          destroy: function () {
            this.scrollbar.destroy()
          }
        }
      }, {
        name: "parallax",
        params: {
          parallax: {
            enabled: !1
          }
        },
        create: function () {
          n.extend(this, {
            parallax: {
              setTransform: ne.setTransform.bind(this),
              setTranslate: ne.setTranslate.bind(this),
              setTransition: ne.setTransition.bind(this)
            }
          })
        },
        on: {
          beforeInit: function () {
            this.params.parallax.enabled && (this.params.watchSlidesProgress = !0, this.originalParams.watchSlidesProgress = !0)
          },
          init: function () {
            this.params.parallax.enabled && this.parallax.setTranslate()
          },
          setTranslate: function () {
            this.params.parallax.enabled && this.parallax.setTranslate()
          },
          setTransition: function (e) {
            this.params.parallax.enabled && this.parallax.setTransition(e)
          }
        }
      }, {
        name: "zoom",
        params: {
          zoom: {
            enabled: !1,
            maxRatio: 3,
            minRatio: 1,
            toggle: !0,
            containerClass: "swiper-zoom-container",
            zoomedSlideClass: "swiper-slide-zoomed"
          }
        },
        create: function () {
          var e = this,
            t = {
              enabled: !1,
              scale: 1,
              currentScale: 1,
              isScaling: !1,
              gesture: {
                $slideEl: void 0,
                slideWidth: void 0,
                slideHeight: void 0,
                $imageEl: void 0,
                $imageWrapEl: void 0,
                maxRatio: 3
              },
              image: {
                isTouched: void 0,
                isMoved: void 0,
                currentX: void 0,
                currentY: void 0,
                minX: void 0,
                minY: void 0,
                maxX: void 0,
                maxY: void 0,
                width: void 0,
                height: void 0,
                startX: void 0,
                startY: void 0,
                touchesStart: {},
                touchesCurrent: {}
              },
              velocity: {
                x: void 0,
                y: void 0,
                prevPositionX: void 0,
                prevPositionY: void 0,
                prevTime: void 0
              }
            };
          "onGestureStart onGestureChange onGestureEnd onTouchStart onTouchMove onTouchEnd onTransitionEnd toggle enable disable in out".split(" ").forEach((function (i) {
            t[i] = oe[i].bind(e)
          })), n.extend(e, {
            zoom: t
          });
          var i = 1;
          Object.defineProperty(e.zoom, "scale", {
            get: function () {
              return i
            },
            set: function (t) {
              if (i !== t) {
                var s = e.zoom.gesture.$imageEl ? e.zoom.gesture.$imageEl[0] : void 0,
                  a = e.zoom.gesture.$slideEl ? e.zoom.gesture.$slideEl[0] : void 0;
                e.emit("zoomChange", t, s, a)
              }
              i = t
            }
          })
        },
        on: {
          init: function () {
            this.params.zoom.enabled && this.zoom.enable()
          },
          destroy: function () {
            this.zoom.disable()
          },
          touchStart: function (e) {
            this.zoom.enabled && this.zoom.onTouchStart(e)
          },
          touchEnd: function (e) {
            this.zoom.enabled && this.zoom.onTouchEnd(e)
          },
          doubleTap: function (e) {
            this.params.zoom.enabled && this.zoom.enabled && this.params.zoom.toggle && this.zoom.toggle(e)
          },
          transitionEnd: function () {
            this.zoom.enabled && this.params.zoom.enabled && this.zoom.onTransitionEnd()
          },
          slideChange: function () {
            this.zoom.enabled && this.params.zoom.enabled && this.params.cssMode && this.zoom.onTransitionEnd()
          }
        }
      }, {
        name: "lazy",
        params: {
          lazy: {
            enabled: !1,
            loadPrevNext: !1,
            loadPrevNextAmount: 1,
            loadOnTransitionStart: !1,
            elementClass: "swiper-lazy",
            loadingClass: "swiper-lazy-loading",
            loadedClass: "swiper-lazy-loaded",
            preloaderClass: "swiper-lazy-preloader"
          }
        },
        create: function () {
          n.extend(this, {
            lazy: {
              initialImageLoaded: !1,
              load: le.load.bind(this),
              loadInSlide: le.loadInSlide.bind(this)
            }
          })
        },
        on: {
          beforeInit: function () {
            this.params.lazy.enabled && this.params.preloadImages && (this.params.preloadImages = !1)
          },
          init: function () {
            this.params.lazy.enabled && !this.params.loop && 0 === this.params.initialSlide && this.lazy.load()
          },
          scroll: function () {
            this.params.freeMode && !this.params.freeModeSticky && this.lazy.load()
          },
          resize: function () {
            this.params.lazy.enabled && this.lazy.load()
          },
          scrollbarDragMove: function () {
            this.params.lazy.enabled && this.lazy.load()
          },
          transitionStart: function () {
            this.params.lazy.enabled && (this.params.lazy.loadOnTransitionStart || !this.params.lazy.loadOnTransitionStart && !this.lazy.initialImageLoaded) && this.lazy.load()
          },
          transitionEnd: function () {
            this.params.lazy.enabled && !this.params.lazy.loadOnTransitionStart && this.lazy.load()
          },
          slideChange: function () {
            this.params.lazy.enabled && this.params.cssMode && this.lazy.load()
          }
        }
      }, {
        name: "controller",
        params: {
          controller: {
            control: void 0,
            inverse: !1,
            by: "slide"
          }
        },
        create: function () {
          n.extend(this, {
            controller: {
              control: this.params.controller.control,
              getInterpolateFunction: de.getInterpolateFunction.bind(this),
              setTranslate: de.setTranslate.bind(this),
              setTransition: de.setTransition.bind(this)
            }
          })
        },
        on: {
          update: function () {
            this.controller.control && this.controller.spline && (this.controller.spline = void 0, delete this.controller.spline)
          },
          resize: function () {
            this.controller.control && this.controller.spline && (this.controller.spline = void 0, delete this.controller.spline)
          },
          observerUpdate: function () {
            this.controller.control && this.controller.spline && (this.controller.spline = void 0, delete this.controller.spline)
          },
          setTranslate: function (e, t) {
            this.controller.control && this.controller.setTranslate(e, t)
          },
          setTransition: function (e, t) {
            this.controller.control && this.controller.setTransition(e, t)
          }
        }
      }, {
        name: "a11y",
        params: {
          a11y: {
            enabled: !0,
            notificationClass: "swiper-notification",
            prevSlideMessage: "Previous slide",
            nextSlideMessage: "Next slide",
            firstSlideMessage: "This is the first slide",
            lastSlideMessage: "This is the last slide",
            paginationBulletMessage: "Go to slide {{index}}"
          }
        },
        create: function () {
          var e = this;
          n.extend(e, {
            a11y: {
              liveRegion: s('<span class="' + e.params.a11y.notificationClass + '" aria-live="assertive" aria-atomic="true"></span>')
            }
          }), Object.keys(he).forEach((function (t) {
            e.a11y[t] = he[t].bind(e)
          }))
        },
        on: {
          init: function () {
            this.params.a11y.enabled && (this.a11y.init(), this.a11y.updateNavigation())
          },
          toEdge: function () {
            this.params.a11y.enabled && this.a11y.updateNavigation()
          },
          fromEdge: function () {
            this.params.a11y.enabled && this.a11y.updateNavigation()
          },
          paginationUpdate: function () {
            this.params.a11y.enabled && this.a11y.updatePagination()
          },
          destroy: function () {
            this.params.a11y.enabled && this.a11y.destroy()
          }
        }
      }, {
        name: "history",
        params: {
          history: {
            enabled: !1,
            replaceState: !1,
            key: "slides"
          }
        },
        create: function () {
          n.extend(this, {
            history: {
              init: pe.init.bind(this),
              setHistory: pe.setHistory.bind(this),
              setHistoryPopState: pe.setHistoryPopState.bind(this),
              scrollToSlide: pe.scrollToSlide.bind(this),
              destroy: pe.destroy.bind(this)
            }
          })
        },
        on: {
          init: function () {
            this.params.history.enabled && this.history.init()
          },
          destroy: function () {
            this.params.history.enabled && this.history.destroy()
          },
          transitionEnd: function () {
            this.history.initialized && this.history.setHistory(this.params.history.key, this.activeIndex)
          },
          slideChange: function () {
            this.history.initialized && this.params.cssMode && this.history.setHistory(this.params.history.key, this.activeIndex)
          }
        }
      }, {
        name: "hash-navigation",
        params: {
          hashNavigation: {
            enabled: !1,
            replaceState: !1,
            watchState: !1
          }
        },
        create: function () {
          n.extend(this, {
            hashNavigation: {
              initialized: !1,
              init: ce.init.bind(this),
              destroy: ce.destroy.bind(this),
              setHash: ce.setHash.bind(this),
              onHashCange: ce.onHashCange.bind(this)
            }
          })
        },
        on: {
          init: function () {
            this.params.hashNavigation.enabled && this.hashNavigation.init()
          },
          destroy: function () {
            this.params.hashNavigation.enabled && this.hashNavigation.destroy()
          },
          transitionEnd: function () {
            this.hashNavigation.initialized && this.hashNavigation.setHash()
          },
          slideChange: function () {
            this.hashNavigation.initialized && this.params.cssMode && this.hashNavigation.setHash()
          }
        }
      }, {
        name: "autoplay",
        params: {
          autoplay: {
            enabled: !1,
            delay: 3e3,
            waitForTransition: !0,
            disableOnInteraction: !0,
            stopOnLastSlide: !1,
            reverseDirection: !1
          }
        },
        create: function () {
          var e = this;
          n.extend(e, {
            autoplay: {
              running: !1,
              paused: !1,
              run: ue.run.bind(e),
              start: ue.start.bind(e),
              stop: ue.stop.bind(e),
              pause: ue.pause.bind(e),
              onVisibilityChange: function () {
                "hidden" === document.visibilityState && e.autoplay.running && e.autoplay.pause(), "visible" === document.visibilityState && e.autoplay.paused && (e.autoplay.run(), e.autoplay.paused = !1)
              },
              onTransitionEnd: function (t) {
                e && !e.destroyed && e.$wrapperEl && t.target === this && (e.$wrapperEl[0].removeEventListener("transitionend", e.autoplay.onTransitionEnd), e.$wrapperEl[0].removeEventListener("webkitTransitionEnd", e.autoplay.onTransitionEnd), e.autoplay.paused = !1, e.autoplay.running ? e.autoplay.run() : e.autoplay.stop())
              }
            }
          })
        },
        on: {
          init: function () {
            this.params.autoplay.enabled && (this.autoplay.start(), document.addEventListener("visibilitychange", this.autoplay.onVisibilityChange))
          },
          beforeTransitionStart: function (e, t) {
            this.autoplay.running && (t || !this.params.autoplay.disableOnInteraction ? this.autoplay.pause(e) : this.autoplay.stop())
          },
          sliderFirstMove: function () {
            this.autoplay.running && (this.params.autoplay.disableOnInteraction ? this.autoplay.stop() : this.autoplay.pause())
          },
          touchEnd: function () {
            this.params.cssMode && this.autoplay.paused && !this.params.autoplay.disableOnInteraction && this.autoplay.run()
          },
          destroy: function () {
            this.autoplay.running && this.autoplay.stop(), document.removeEventListener("visibilitychange", this.autoplay.onVisibilityChange)
          }
        }
      }, {
        name: "effect-fade",
        params: {
          fadeEffect: {
            crossFade: !1
          }
        },
        create: function () {
          n.extend(this, {
            fadeEffect: {
              setTranslate: ve.setTranslate.bind(this),
              setTransition: ve.setTransition.bind(this)
            }
          })
        },
        on: {
          beforeInit: function () {
            if ("fade" === this.params.effect) {
              this.classNames.push(this.params.containerModifierClass + "fade");
              var e = {
                slidesPerView: 1,
                slidesPerColumn: 1,
                slidesPerGroup: 1,
                watchSlidesProgress: !0,
                spaceBetween: 0,
                virtualTranslate: !0
              };
              n.extend(this.params, e), n.extend(this.originalParams, e)
            }
          },
          setTranslate: function () {
            "fade" === this.params.effect && this.fadeEffect.setTranslate()
          },
          setTransition: function (e) {
            "fade" === this.params.effect && this.fadeEffect.setTransition(e)
          }
        }
      }, {
        name: "effect-cube",
        params: {
          cubeEffect: {
            slideShadows: !0,
            shadow: !0,
            shadowOffset: 20,
            shadowScale: .94
          }
        },
        create: function () {
          n.extend(this, {
            cubeEffect: {
              setTranslate: fe.setTranslate.bind(this),
              setTransition: fe.setTransition.bind(this)
            }
          })
        },
        on: {
          beforeInit: function () {
            if ("cube" === this.params.effect) {
              this.classNames.push(this.params.containerModifierClass + "cube"), this.classNames.push(this.params.containerModifierClass + "3d");
              var e = {
                slidesPerView: 1,
                slidesPerColumn: 1,
                slidesPerGroup: 1,
                watchSlidesProgress: !0,
                resistanceRatio: 0,
                spaceBetween: 0,
                centeredSlides: !1,
                virtualTranslate: !0
              };
              n.extend(this.params, e), n.extend(this.originalParams, e)
            }
          },
          setTranslate: function () {
            "cube" === this.params.effect && this.cubeEffect.setTranslate()
          },
          setTransition: function (e) {
            "cube" === this.params.effect && this.cubeEffect.setTransition(e)
          }
        }
      }, {
        name: "effect-flip",
        params: {
          flipEffect: {
            slideShadows: !0,
            limitRotation: !0
          }
        },
        create: function () {
          n.extend(this, {
            flipEffect: {
              setTranslate: me.setTranslate.bind(this),
              setTransition: me.setTransition.bind(this)
            }
          })
        },
        on: {
          beforeInit: function () {
            if ("flip" === this.params.effect) {
              this.classNames.push(this.params.containerModifierClass + "flip"), this.classNames.push(this.params.containerModifierClass + "3d");
              var e = {
                slidesPerView: 1,
                slidesPerColumn: 1,
                slidesPerGroup: 1,
                watchSlidesProgress: !0,
                spaceBetween: 0,
                virtualTranslate: !0
              };
              n.extend(this.params, e), n.extend(this.originalParams, e)
            }
          },
          setTranslate: function () {
            "flip" === this.params.effect && this.flipEffect.setTranslate()
          },
          setTransition: function (e) {
            "flip" === this.params.effect && this.flipEffect.setTransition(e)
          }
        }
      }, {
        name: "effect-coverflow",
        params: {
          coverflowEffect: {
            rotate: 50,
            stretch: 0,
            depth: 100,
            modifier: 1,
            slideShadows: !0
          }
        },
        create: function () {
          n.extend(this, {
            coverflowEffect: {
              setTranslate: ge.setTranslate.bind(this),
              setTransition: ge.setTransition.bind(this)
            }
          })
        },
        on: {
          beforeInit: function () {
            "coverflow" === this.params.effect && (this.classNames.push(this.params.containerModifierClass + "coverflow"), this.classNames.push(this.params.containerModifierClass + "3d"), this.params.watchSlidesProgress = !0, this.originalParams.watchSlidesProgress = !0)
          },
          setTranslate: function () {
            "coverflow" === this.params.effect && this.coverflowEffect.setTranslate()
          },
          setTransition: function (e) {
            "coverflow" === this.params.effect && this.coverflowEffect.setTransition(e)
          }
        }
      }, {
        name: "thumbs",
        params: {
          thumbs: {
            multipleActiveThumbs: !0,
            swiper: null,
            slideThumbActiveClass: "swiper-slide-thumb-active",
            thumbsContainerClass: "swiper-container-thumbs"
          }
        },
        create: function () {
          n.extend(this, {
            thumbs: {
              swiper: null,
              init: be.init.bind(this),
              update: be.update.bind(this),
              onThumbClick: be.onThumbClick.bind(this)
            }
          })
        },
        on: {
          beforeInit: function () {
            var e = this.params.thumbs;
            e && e.swiper && (this.thumbs.init(), this.thumbs.update(!0))
          },
          slideChange: function () {
            this.thumbs.swiper && this.thumbs.update()
          },
          update: function () {
            this.thumbs.swiper && this.thumbs.update()
          },
          resize: function () {
            this.thumbs.swiper && this.thumbs.update()
          },
          observerUpdate: function () {
            this.thumbs.swiper && this.thumbs.update()
          },
          setTransition: function (e) {
            var t = this.thumbs.swiper;
            t && t.setTransition(e)
          },
          beforeDestroy: function () {
            var e = this.thumbs.swiper;
            e && this.thumbs.swiperCreated && e && e.destroy()
          }
        }
      }];
  return void 0 === W.use && (W.use = W.Class.use, W.installModule = W.Class.installModule), W.use(we), W
}));
(function (a) {
  window.ShareLink = function (b, c) {
    var d, e = {},
      f = function (a) {
        var b = a.substr(0, e.classPrefixLength);
        return b === e.classPrefix ? a.substr(e.classPrefixLength) : null
      },
      g = function (a) {
        d.on("click", function () {
          h(a)
        })
      },
      h = function (a) {
        var b = "";
        if (e.width && e.height) {
          var c = screen.width / 2 - e.width / 2,
            d = screen.height / 2 - e.height / 2;
          b = "toolbar=0,status=0,width=" + e.width + ",height=" + e.height + ",top=" + d + ",left=" + c
        }
        var f = ShareLink.getNetworkLink(a, e),
          g = /^https?:\/\//.test(f),
          h = g ? "" : "_self";
        open(f, h, b)
      },
      i = function () {
        a.each(b.classList, function () {
          var a = f(this);
          if (a) return g(a), !1
        })
      },
      j = function () {
        a.extend(e, ShareLink.defaultSettings, c), ["title", "text"].forEach(function (a) {
          e[a] = e[a].replace("#", "")
        }), e.classPrefixLength = e.classPrefix.length
      },
      k = function () {
        d = a(b)
      };
    (function () {
      j(), k(), i()
    })()
  }, ShareLink.networkTemplates = {
    twitter: "https://twitter.com/intent/tweet?text={text}{url}",
    pinterest: "https://www.pinterest.com/pin/create/button/?url={url}&media={image}",
    facebook: "https://www.facebook.com/sharer.php?u={url}",
    vk: "https://vkontakte.ru/share.php?url={url}&title={title}&description={text}&image={image}",
    linkedin: "https://www.linkedin.com/shareArticle?mini=true&url={url}&title={title}&summary={text}&source={url}",
    odnoklassniki: "https://connect.ok.ru/offer?url={url}&title={title}&imageUrl={image}",
    tumblr: "https://tumblr.com/share/link?url={url}",
    delicious: "https://del.icio.us/save?url={url}&title={title}",
    google: "https://plus.google.com/share?url={url}",
    digg: "https://digg.com/submit?url={url}",
    reddit: "https://reddit.com/submit?url={url}&title={title}",
    stumbleupon: "https://www.stumbleupon.com/submit?url={url}",
    pocket: "https://getpocket.com/edit?url={url}",
    whatsapp: "https://api.whatsapp.com/send?text=*{title}*\n{text}\n{url}",
    xing: "https://www.xing.com/app/user?op=share&url={url}",
    print: "javascript:print()",
    email: "mailto:?subject={title}&body={text}\n{url}",
    telegram: "https://telegram.me/share/url?url={url}&text={text}",
    skype: "https://web.skype.com/share?url={url}"
  }, ShareLink.defaultSettings = {
    title: "",
    text: "",
    image: "",
    url: location.href,
    classPrefix: "s_",
    width: 640,
    height: 480
  }, ShareLink.getNetworkLink = function (a, b) {
    var c = ShareLink.networkTemplates[a].replace(/{([^}]+)}/g, function (a, c) {
      return b[c] || ""
    });
    if ("email" === a) {
      if (-1 < b.title.indexOf("&") || -1 < b.text.indexOf("&")) {
        var d = {
          text: b.text.replace(/&/g, "%26"),
          title: b.title.replace(/&/g, "%26"),
          url: b.url
        };
        c = ShareLink.networkTemplates[a].replace(/{([^}]+)}/g, function (a, b) {
          return d[b]
        })
      }
      return c.indexOf("?subject=&body") && (c = c.replace("subject=&", "")), c
    }
    return c
  }, a.fn.shareLink = function (b) {
    return this.each(function () {
      a(this).data("shareLink", new ShareLink(this, b))
    })
  }
})(jQuery); /*! elementor - v3.0.2 - 26-08-2020 */
! function (e) {
  var t = {};

  function __webpack_require__(n) {
    if (t[n]) return t[n].exports;
    var i = t[n] = {
      i: n,
      l: !1,
      exports: {}
    };
    return e[n].call(i.exports, i, i.exports, __webpack_require__), i.l = !0, i.exports
  }
  __webpack_require__.m = e, __webpack_require__.c = t, __webpack_require__.d = function (e, t, n) {
    __webpack_require__.o(e, t) || Object.defineProperty(e, t, {
      enumerable: !0,
      get: n
    })
  }, __webpack_require__.r = function (e) {
    "undefined" != typeof Symbol && Symbol.toStringTag && Object.defineProperty(e, Symbol.toStringTag, {
      value: "Module"
    }), Object.defineProperty(e, "__esModule", {
      value: !0
    })
  }, __webpack_require__.t = function (e, t) {
    if (1 & t && (e = __webpack_require__(e)), 8 & t) return e;
    if (4 & t && "object" == typeof e && e && e.__esModule) return e;
    var n = Object.create(null);
    if (__webpack_require__.r(n), Object.defineProperty(n, "default", {
      enumerable: !0,
      value: e
    }), 2 & t && "string" != typeof e)
      for (var i in e) __webpack_require__.d(n, i, function (t) {
        return e[t]
      }.bind(null, i));
    return n
  }, __webpack_require__.n = function (e) {
    var t = e && e.__esModule ? function getDefault() {
      return e.default
    } : function getModuleExports() {
      return e
    };
    return __webpack_require__.d(t, "a", t), t
  }, __webpack_require__.o = function (e, t) {
    return Object.prototype.hasOwnProperty.call(e, t)
  }, __webpack_require__.p = "", __webpack_require__(__webpack_require__.s = 785)
}([function (e, t) {
  e.exports = function _interopRequireDefault(e) {
    return e && e.__esModule ? e : {
      default: e
    }
  }
}, function (e, t, n) {
  e.exports = n(155)
}, function (e, t) {
  e.exports = function _classCallCheck(e, t) {
    if (!(e instanceof t)) throw new TypeError("Cannot call a class as a function")
  }
}, function (e, t, n) {
  var i = n(1);

  function _defineProperties(e, t) {
    for (var n = 0; n < t.length; n++) {
      var r = t[n];
      r.enumerable = r.enumerable || !1, r.configurable = !0, "value" in r && (r.writable = !0), i(e, r.key, r)
    }
  }
  e.exports = function _createClass(e, t, n) {
    return t && _defineProperties(e.prototype, t), n && _defineProperties(e, n), e
  }
}, function (e, t, n) {
  var i = n(137),
    r = n(135);
  e.exports = function _inherits(e, t) {
    if ("function" != typeof t && null !== t) throw new TypeError("Super expression must either be null or a function");
    e.prototype = i(t && t.prototype, {
      constructor: {
        value: e,
        writable: !0,
        configurable: !0
      }
    }), t && r(e, t)
  }
}, function (e, t, n) {
  var i = n(107),
    r = n(16),
    o = n(148),
    s = n(170);
  e.exports = function _createSuper(e) {
    var t = o();
    return function _createSuperInternal() {
      var n, o = r(e);
      if (t) {
        var a = r(this).constructor;
        n = i(o, arguments, a)
      } else n = o.apply(this, arguments);
      return s(this, n)
    }
  }
}, function (e, t) {
  var n = e.exports = {
    version: "2.6.11"
  };
  "number" == typeof __e && (__e = n)
}, function (e, t, n) {
  var i = n(8),
    r = n(6),
    o = n(31),
    s = n(24),
    a = n(19),
    $export = function (e, t, n) {
      var l, u, c, d = e & $export.F,
        f = e & $export.G,
        h = e & $export.S,
        p = e & $export.P,
        v = e & $export.B,
        g = e & $export.W,
        m = f ? r : r[t] || (r[t] = {}),
        y = m.prototype,
        b = f ? i : h ? i[t] : (i[t] || {}).prototype;
      for (l in f && (n = t), n) (u = !d && b && void 0 !== b[l]) && a(m, l) || (c = u ? b[l] : n[l], m[l] = f && "function" != typeof b[l] ? n[l] : v && u ? o(c, i) : g && b[l] == c ? function (e) {
        var F = function (t, n, i) {
          if (this instanceof e) {
            switch (arguments.length) {
              case 0:
                return new e;
              case 1:
                return new e(t);
              case 2:
                return new e(t, n)
            }
            return new e(t, n, i)
          }
          return e.apply(this, arguments)
        };
        return F.prototype = e.prototype, F
      }(c) : p && "function" == typeof c ? o(Function.call, c) : c, p && ((m.virtual || (m.virtual = {}))[l] = c, e & $export.R && y && !y[l] && s(y, l, c)))
    };
  $export.F = 1, $export.G = 2, $export.S = 4, $export.P = 8, $export.B = 16, $export.W = 32, $export.U = 64, $export.R = 128, e.exports = $export
}, function (e, t) {
  var n = e.exports = "undefined" != typeof window && window.Math == Math ? window : "undefined" != typeof self && self.Math == Math ? self : Function("return this")();
  "number" == typeof __g && (__g = n)
}, function (e, t) {
  e.exports = function (e) {
    return "object" == typeof e ? null !== e : "function" == typeof e
  }
}, function (e, t, n) {
  var i = n(76)("wks"),
    r = n(59),
    o = n(8).Symbol,
    s = "function" == typeof o;
  (e.exports = function (e) {
    return i[e] || (i[e] = s && o[e] || (s ? o : r)("Symbol." + e))
  }).store = i
}, , function (e, t, n) {
  var i = n(66)("wks"),
    r = n(67),
    o = n(17).Symbol,
    s = "function" == typeof o;
  (e.exports = function (e) {
    return i[e] || (i[e] = s && o[e] || (s ? o : r)("Symbol." + e))
  }).store = i
}, function (e, t, n) {
  var i = n(9);
  e.exports = function (e) {
    if (!i(e)) throw TypeError(e + " is not an object!");
    return e
  }
}, function (e, t, n) {
  e.exports = !n(22)((function () {
    return 7 != Object.defineProperty({}, "a", {
      get: function () {
        return 7
      }
    }).a
  }))
}, function (e, t, n) {
  var i = n(13),
    r = n(114),
    o = n(74),
    s = Object.defineProperty;
  t.f = n(14) ? Object.defineProperty : function defineProperty(e, t, n) {
    if (i(e), t = o(t, !0), i(n), r) try {
      return s(e, t, n)
    } catch (e) { }
    if ("get" in n || "set" in n) throw TypeError("Accessors not supported!");
    return "value" in n && (e[t] = n.value), e
  }
}, function (e, t, n) {
  var i = n(157),
    r = n(115);

  function _getPrototypeOf(t) {
    return e.exports = _getPrototypeOf = r ? i : function _getPrototypeOf(e) {
      return e.__proto__ || i(e)
    }, _getPrototypeOf(t)
  }
  e.exports = _getPrototypeOf
}, function (e, t) {
  var n = e.exports = "undefined" != typeof window && window.Math == Math ? window : "undefined" != typeof self && self.Math == Math ? self : Function("return this")();
  "number" == typeof __g && (__g = n)
}, function (e, t, n) {
  var i = n(30);
  e.exports = function (e) {
    if (!i(e)) throw TypeError(e + " is not an object!");
    return e
  }
}, function (e, t) {
  var n = {}.hasOwnProperty;
  e.exports = function (e, t) {
    return n.call(e, t)
  }
}, function (e, t, n) {
  var i = n(103),
    r = n(65);
  e.exports = function (e) {
    return i(r(e))
  }
}, , function (e, t) {
  e.exports = function (e) {
    try {
      return !!e()
    } catch (e) {
      return !0
    }
  }
}, function (e, t, n) {
  e.exports = n(201)
}, function (e, t, n) {
  var i = n(15),
    r = n(44);
  e.exports = n(14) ? function (e, t, n) {
    return i.f(e, t, r(1, n))
  } : function (e, t, n) {
    return e[t] = n, e
  }
}, function (e, t, n) {
  var i = n(124),
    r = n(193),
    o = n(196);

  function _get(t, n, s) {
    return "undefined" != typeof Reflect && r ? e.exports = _get = r : e.exports = _get = function _get(e, t, n) {
      var r = o(e, t);
      if (r) {
        var s = i(r, t);
        return s.get ? s.get.call(n) : s.value
      }
    }, _get(t, n, s || t)
  }
  e.exports = _get
}, function (e, t, n) {
  "use strict";
  var i = n(37),
    r = n(181)(5),
    o = !0;
  "find" in [] && Array(1).find((function () {
    o = !1
  })), i(i.P + i.F * o, "Array", {
    find: function find(e) {
      return r(this, e, arguments.length > 1 ? arguments[1] : void 0)
    }
  }), n(85)("find")
}, function (e, t, n) {
  e.exports = !n(33)((function () {
    return 7 != Object.defineProperty({}, "a", {
      get: function () {
        return 7
      }
    }).a
  }))
}, , function (e, t, n) {
  var i = n(45),
    r = n(102);
  e.exports = n(27) ? function (e, t, n) {
    return i.f(e, t, r(1, n))
  } : function (e, t, n) {
    return e[t] = n, e
  }
}, function (e, t) {
  e.exports = function (e) {
    return "object" == typeof e ? null !== e : "function" == typeof e
  }
}, function (e, t, n) {
  var i = n(38);
  e.exports = function (e, t, n) {
    if (i(e), void 0 === t) return e;
    switch (n) {
      case 1:
        return function (n) {
          return e.call(t, n)
        };
      case 2:
        return function (n, i) {
          return e.call(t, n, i)
        };
      case 3:
        return function (n, i, r) {
          return e.call(t, n, i, r)
        }
    }
    return function () {
      return e.apply(t, arguments)
    }
  }
}, function (e, t, n) {
  var i = n(65);
  e.exports = function (e) {
    return Object(i(e))
  }
}, function (e, t) {
  e.exports = function (e) {
    try {
      return !!e()
    } catch (e) {
      return !0
    }
  }
}, function (e, t) {
  e.exports = {}
}, function (e, t, n) {
  var i = n(17),
    r = n(29),
    o = n(61),
    s = n(67)("src"),
    a = n(143),
    l = ("" + a).split("toString");
  n(55).inspectSource = function (e) {
    return a.call(e)
  }, (e.exports = function (e, t, n, a) {
    var u = "function" == typeof n;
    u && (o(n, "name") || r(n, "name", t)), e[t] !== n && (u && (o(n, s) || r(n, s, e[t] ? "" + e[t] : l.join(String(t)))), e === i ? e[t] = n : a ? e[t] ? e[t] = n : r(e, t, n) : (delete e[t], r(e, t, n)))
  })(Function.prototype, "toString", (function toString() {
    return "function" == typeof this && this[s] || a.call(this)
  }))
}, , function (e, t, n) {
  var i = n(17),
    r = n(55),
    o = n(29),
    s = n(35),
    a = n(73),
    $export = function (e, t, n) {
      var l, u, c, d, f = e & $export.F,
        h = e & $export.G,
        p = e & $export.S,
        v = e & $export.P,
        g = e & $export.B,
        m = h ? i : p ? i[t] || (i[t] = {}) : (i[t] || {}).prototype,
        y = h ? r : r[t] || (r[t] = {}),
        b = y.prototype || (y.prototype = {});
      for (l in h && (n = t), n) c = ((u = !f && m && void 0 !== m[l]) ? m : n)[l], d = g && u ? a(c, i) : v && "function" == typeof c ? a(Function.call, c) : c, m && s(m, l, c, e & $export.U), y[l] != c && o(y, l, d), v && b[l] != c && (b[l] = c)
    };
  i.core = r, $export.F = 1, $export.G = 2, $export.S = 4, $export.P = 8, $export.B = 16, $export.W = 32, $export.U = 64, $export.R = 128, e.exports = $export
}, function (e, t) {
  e.exports = function (e) {
    if ("function" != typeof e) throw TypeError(e + " is not a function!");
    return e
  }
}, , function (e, t, n) {
  var i = n(116),
    r = n(78);
  e.exports = Object.keys || function keys(e) {
    return i(e, r)
  }
}, , function (e, t) {
  e.exports = function (e) {
    if (null == e) throw TypeError("Can't call method on  " + e);
    return e
  }
}, function (e, t, n) {
  var i = n(57),
    r = Math.min;
  e.exports = function (e) {
    return e > 0 ? r(i(e), 9007199254740991) : 0
  }
}, function (e, t) {
  e.exports = function (e, t) {
    return {
      enumerable: !(1 & e),
      configurable: !(2 & e),
      writable: !(4 & e),
      value: t
    }
  }
}, function (e, t, n) {
  var i = n(18),
    r = n(129),
    o = n(123),
    s = Object.defineProperty;
  t.f = n(27) ? Object.defineProperty : function defineProperty(e, t, n) {
    if (i(e), t = o(t, !0), i(n), r) try {
      return s(e, t, n)
    } catch (e) { }
    if ("get" in n || "set" in n) throw TypeError("Accessors not supported!");
    return "value" in n && (e[t] = n.value), e
  }
}, function (e, t) {
  var n = {}.toString;
  e.exports = function (e) {
    return n.call(e).slice(8, -1)
  }
}, function (e, t) {
  e.exports = !0
}, function (e, t, n) {
  var i = n(151),
    r = n(111);

  function _typeof(t) {
    return e.exports = _typeof = "function" == typeof r && "symbol" == typeof i ? function _typeof(e) {
      return typeof e
    } : function _typeof(e) {
      return e && "function" == typeof r && e.constructor === r && e !== r.prototype ? "symbol" : typeof e
    }, _typeof(t)
  }
  e.exports = _typeof
}, function (e, t) {
  e.exports = function _assertThisInitialized(e) {
    if (void 0 === e) throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    return e
  }
}, function (e, t) {
  t.f = {}.propertyIsEnumerable
}, function (e, t, n) {
  var i = n(50),
    r = n(44),
    o = n(20),
    s = n(74),
    a = n(19),
    l = n(114),
    u = Object.getOwnPropertyDescriptor;
  t.f = n(14) ? u : function getOwnPropertyDescriptor(e, t) {
    if (e = o(e), t = s(t, !0), l) try {
      return u(e, t)
    } catch (e) { }
    if (a(e, t)) return r(!i.f.call(e, t), e[t])
  }
}, function (e, t, n) {
  var i = n(13),
    r = n(134),
    o = n(78),
    s = n(75)("IE_PROTO"),
    Empty = function () { },
    createDict = function () {
      var e, t = n(92)("iframe"),
        i = o.length;
      for (t.style.display = "none", n(131).appendChild(t), t.src = "javascript:", (e = t.contentWindow.document).open(), e.write("<script>document.F=Object<\/script>"), e.close(), createDict = e.F; i--;) delete createDict.prototype[o[i]];
      return createDict()
    };
  e.exports = Object.create || function create(e, t) {
    var n;
    return null !== e ? (Empty.prototype = i(e), n = new Empty, Empty.prototype = null, n[s] = e) : n = createDict(), void 0 === t ? n : r(n, t)
  }
}, function (e, t, n) {
  var i = n(15).f,
    r = n(19),
    o = n(10)("toStringTag");
  e.exports = function (e, t, n) {
    e && !r(e = n ? e : e.prototype, o) && i(e, o, {
      configurable: !0,
      value: t
    })
  }
}, function (e, t, n) {
  e.exports = n(239)
}, function (e, t) {
  var n = e.exports = {
    version: "2.6.11"
  };
  "number" == typeof __e && (__e = n)
}, function (e, t) {
  var n = {}.toString;
  e.exports = function (e) {
    return n.call(e).slice(8, -1)
  }
}, function (e, t) {
  var n = Math.ceil,
    i = Math.floor;
  e.exports = function (e) {
    return isNaN(e = +e) ? 0 : (e > 0 ? i : n)(e)
  }
}, function (e, t, n) {
  "use strict";
  var i = n(18),
    r = n(96),
    o = n(43),
    s = n(57),
    a = n(105),
    l = n(94),
    u = Math.max,
    c = Math.min,
    d = Math.floor,
    f = /\$([$&`']|\d\d?|<[^>]*>)/g,
    h = /\$([$&`']|\d\d?)/g;
  n(95)("replace", 2, (function (e, t, n, p) {
    return [function replace(i, r) {
      var o = e(this),
        s = null == i ? void 0 : i[t];
      return void 0 !== s ? s.call(i, o, r) : n.call(String(o), i, r)
    }, function (e, t) {
      var r = p(n, e, this, t);
      if (r.done) return r.value;
      var d = i(e),
        f = String(this),
        h = "function" == typeof t;
      h || (t = String(t));
      var v = d.global;
      if (v) {
        var g = d.unicode;
        d.lastIndex = 0
      }
      for (var m = []; ;) {
        var y = l(d, f);
        if (null === y) break;
        if (m.push(y), !v) break;
        "" === String(y[0]) && (d.lastIndex = a(f, o(d.lastIndex), g))
      }
      for (var b, _ = "", w = 0, S = 0; S < m.length; S++) {
        y = m[S];
        for (var k = String(y[0]), x = u(c(s(y.index), f.length), 0), E = [], C = 1; C < y.length; C++) E.push(void 0 === (b = y[C]) ? b : String(b));
        var M = y.groups;
        if (h) {
          var $ = [k].concat(E, x, f);
          void 0 !== M && $.push(M);
          var O = String(t.apply(void 0, $))
        } else O = getSubstitution(k, f, x, E, M, t);
        x >= w && (_ += f.slice(w, x) + O, w = x + k.length)
      }
      return _ + f.slice(w)
    }];

    function getSubstitution(e, t, i, o, s, a) {
      var l = i + e.length,
        u = o.length,
        c = h;
      return void 0 !== s && (s = r(s), c = f), n.call(a, c, (function (n, r) {
        var a;
        switch (r.charAt(0)) {
          case "$":
            return "$";
          case "&":
            return e;
          case "`":
            return t.slice(0, i);
          case "'":
            return t.slice(l);
          case "<":
            a = s[r.slice(1, -1)];
            break;
          default:
            var c = +r;
            if (0 === c) return n;
            if (c > u) {
              var f = d(c / 10);
              return 0 === f ? n : f <= u ? void 0 === o[f - 1] ? r.charAt(1) : o[f - 1] + r.charAt(1) : n
            }
            a = o[c - 1]
        }
        return void 0 === a ? "" : a
      }))
    }
  }))
}, function (e, t) {
  var n = 0,
    i = Math.random();
  e.exports = function (e) {
    return "Symbol(".concat(void 0 === e ? "" : e, ")_", (++n + i).toString(36))
  }
}, function (e, t, n) {
  "use strict";
  var i = n(172)(!0);
  n(108)(String, "String", (function (e) {
    this._t = String(e), this._i = 0
  }), (function () {
    var e, t = this._t,
      n = this._i;
    return n >= t.length ? {
      value: void 0,
      done: !0
    } : (e = i(t, n), this._i += e.length, {
      value: e,
      done: !1
    })
  }))
}, function (e, t) {
  var n = {}.hasOwnProperty;
  e.exports = function (e, t) {
    return n.call(e, t)
  }
}, function (e, t, n) {
  n(174);
  for (var i = n(8), r = n(24), o = n(34), s = n(10)("toStringTag"), a = "CSSRuleList,CSSStyleDeclaration,CSSValueList,ClientRectList,DOMRectList,DOMStringList,DOMTokenList,DataTransferItemList,FileList,HTMLAllCollection,HTMLCollection,HTMLFormElement,HTMLSelectElement,MediaList,MimeTypeArray,NamedNodeMap,NodeList,PaintRequestList,Plugin,PluginArray,SVGLengthList,SVGNumberList,SVGPathSegList,SVGPointList,SVGStringList,SVGTransformList,SourceBufferList,StyleSheetList,TextTrackCueList,TextTrackList,TouchList".split(","), l = 0; l < a.length; l++) {
    var u = a[l],
      c = i[u],
      d = c && c.prototype;
    d && !d[s] && r(d, s, u), o[u] = o.Array
  }
}, function (e, t, n) {
  t.f = n(10)
}, function (e, t, n) {
  var i = n(19),
    r = n(32),
    o = n(75)("IE_PROTO"),
    s = Object.prototype;
  e.exports = Object.getPrototypeOf || function (e) {
    return e = r(e), i(e, o) ? e[o] : "function" == typeof e.constructor && e instanceof e.constructor ? e.constructor.prototype : e instanceof Object ? s : null
  }
}, function (e, t) {
  e.exports = function (e) {
    if (null == e) throw TypeError("Can't call method on  " + e);
    return e
  }
}, function (e, t, n) {
  var i = n(55),
    r = n(17),
    o = r["__core-js_shared__"] || (r["__core-js_shared__"] = {});
  (e.exports = function (e, t) {
    return o[e] || (o[e] = void 0 !== t ? t : {})
  })("versions", []).push({
    version: i.version,
    mode: n(110) ? "pure" : "global",
    copyright: "© 2019 Denis Pushkarev (zloirock.ru)"
  })
}, function (e, t) {
  var n = 0,
    i = Math.random();
  e.exports = function (e) {
    return "Symbol(".concat(void 0 === e ? "" : e, ")_", (++n + i).toString(36))
  }
}, function (e, t, n) {
  var i = n(77),
    r = Math.min;
  e.exports = function (e) {
    return e > 0 ? r(i(e), 9007199254740991) : 0
  }
}, , function (e, t, n) {
  var i = n(59)("meta"),
    r = n(9),
    o = n(19),
    s = n(15).f,
    a = 0,
    l = Object.isExtensible || function () {
      return !0
    },
    u = !n(22)((function () {
      return l(Object.preventExtensions({}))
    })),
    setMeta = function (e) {
      s(e, i, {
        value: {
          i: "O" + ++a,
          w: {}
        }
      })
    },
    c = e.exports = {
      KEY: i,
      NEED: !1,
      fastKey: function (e, t) {
        if (!r(e)) return "symbol" == typeof e ? e : ("string" == typeof e ? "S" : "P") + e;
        if (!o(e, i)) {
          if (!l(e)) return "F";
          if (!t) return "E";
          setMeta(e)
        }
        return e[i].i
      },
      getWeak: function (e, t) {
        if (!o(e, i)) {
          if (!l(e)) return !0;
          if (!t) return !1;
          setMeta(e)
        }
        return e[i].w
      },
      onFreeze: function (e) {
        return u && c.NEED && l(e) && !o(e, i) && setMeta(e), e
      }
    }
}, function (e, t) {
  t.f = Object.getOwnPropertySymbols
}, function (e, t, n) {
  "use strict";
  var i = n(113),
    r = {};
  r[n(12)("toStringTag")] = "z", r + "" != "[object z]" && n(35)(Object.prototype, "toString", (function toString() {
    return "[object " + i(this) + "]"
  }), !0)
}, function (e, t, n) {
  var i = n(91);
  e.exports = function (e, t, n) {
    if (i(e), void 0 === t) return e;
    switch (n) {
      case 1:
        return function (n) {
          return e.call(t, n)
        };
      case 2:
        return function (n, i) {
          return e.call(t, n, i)
        };
      case 3:
        return function (n, i, r) {
          return e.call(t, n, i, r)
        }
    }
    return function () {
      return e.apply(t, arguments)
    }
  }
}, function (e, t, n) {
  var i = n(9);
  e.exports = function (e, t) {
    if (!i(e)) return e;
    var n, r;
    if (t && "function" == typeof (n = e.toString) && !i(r = n.call(e))) return r;
    if ("function" == typeof (n = e.valueOf) && !i(r = n.call(e))) return r;
    if (!t && "function" == typeof (n = e.toString) && !i(r = n.call(e))) return r;
    throw TypeError("Can't convert object to primitive value")
  }
}, function (e, t, n) {
  var i = n(76)("keys"),
    r = n(59);
  e.exports = function (e) {
    return i[e] || (i[e] = r(e))
  }
}, function (e, t, n) {
  var i = n(6),
    r = n(8),
    o = r["__core-js_shared__"] || (r["__core-js_shared__"] = {});
  (e.exports = function (e, t) {
    return o[e] || (o[e] = void 0 !== t ? t : {})
  })("versions", []).push({
    version: i.version,
    mode: n(47) ? "pure" : "global",
    copyright: "© 2019 Denis Pushkarev (zloirock.ru)"
  })
}, function (e, t) {
  var n = Math.ceil,
    i = Math.floor;
  e.exports = function (e) {
    return isNaN(e = +e) ? 0 : (e > 0 ? i : n)(e)
  }
}, function (e, t) {
  e.exports = "constructor,hasOwnProperty,isPrototypeOf,propertyIsEnumerable,toLocaleString,toString,valueOf".split(",")
}, function (e, t, n) {
  var i = n(8),
    r = n(6),
    o = n(47),
    s = n(63),
    a = n(15).f;
  e.exports = function (e) {
    var t = r.Symbol || (r.Symbol = o ? {} : i.Symbol || {});
    "_" == e.charAt(0) || e in t || a(t, e, {
      value: s.f(e)
    })
  }
}, function (e, t, n) {
  "use strict";
  var i = n(122),
    r = n(18),
    o = n(154),
    s = n(105),
    a = n(43),
    l = n(94),
    u = n(88),
    c = n(33),
    d = Math.min,
    f = [].push,
    h = "length",
    p = !c((function () {
      RegExp(4294967295, "y")
    }));
  n(95)("split", 2, (function (e, t, n, c) {
    var v;
    return v = "c" == "abbc".split(/(b)*/)[1] || 4 != "test".split(/(?:)/, -1)[h] || 2 != "ab".split(/(?:ab)*/)[h] || 4 != ".".split(/(.?)(.?)/)[h] || ".".split(/()()/)[h] > 1 || "".split(/.?/)[h] ? function (e, t) {
      var r = String(this);
      if (void 0 === e && 0 === t) return [];
      if (!i(e)) return n.call(r, e, t);
      for (var o, s, a, l = [], c = (e.ignoreCase ? "i" : "") + (e.multiline ? "m" : "") + (e.unicode ? "u" : "") + (e.sticky ? "y" : ""), d = 0, p = void 0 === t ? 4294967295 : t >>> 0, v = new RegExp(e.source, c + "g");
        (o = u.call(v, r)) && !((s = v.lastIndex) > d && (l.push(r.slice(d, o.index)), o[h] > 1 && o.index < r[h] && f.apply(l, o.slice(1)), a = o[0][h], d = s, l[h] >= p));) v.lastIndex === o.index && v.lastIndex++;
      return d === r[h] ? !a && v.test("") || l.push("") : l.push(r.slice(d)), l[h] > p ? l.slice(0, p) : l
    } : "0".split(void 0, 0)[h] ? function (e, t) {
      return void 0 === e && 0 === t ? [] : n.call(this, e, t)
    } : n, [function split(n, i) {
      var r = e(this),
        o = null == n ? void 0 : n[t];
      return void 0 !== o ? o.call(n, r, i) : v.call(String(r), n, i)
    }, function (e, t) {
      var i = c(v, e, this, t, v !== n);
      if (i.done) return i.value;
      var u = r(e),
        f = String(this),
        h = o(u, RegExp),
        g = u.unicode,
        m = (u.ignoreCase ? "i" : "") + (u.multiline ? "m" : "") + (u.unicode ? "u" : "") + (p ? "y" : "g"),
        y = new h(p ? u : "^(?:" + u.source + ")", m),
        b = void 0 === t ? 4294967295 : t >>> 0;
      if (0 === b) return [];
      if (0 === f.length) return null === l(y, f) ? [f] : [];
      for (var _ = 0, w = 0, S = []; w < f.length;) {
        y.lastIndex = p ? w : 0;
        var k, x = l(y, p ? f : f.slice(w));
        if (null === x || (k = d(a(y.lastIndex + (p ? 0 : w)), f.length)) === _) w = s(f, w, g);
        else {
          if (S.push(f.slice(_, w)), S.length === b) return S;
          for (var E = 1; E <= x.length - 1; E++)
            if (S.push(x[E]), S.length === b) return S;
          w = _ = k
        }
      }
      return S.push(f.slice(_)), S
    }]
  }))
}, , , function (e, t, n) {
  var i = n(7),
    r = n(6),
    o = n(22);
  e.exports = function (e, t) {
    var n = (r.Object || {})[e] || Object[e],
      s = {};
    s[e] = t(n), i(i.S + i.F * o((function () {
      n(1)
    })), "Object", s)
  }
}, , function (e, t, n) {
  var i = n(12)("unscopables"),
    r = Array.prototype;
  null == r[i] && n(29)(r, i, {}), e.exports = function (e) {
    r[i][e] = !0
  }
}, function (e, t, n) {
  var i = n(31),
    r = n(139),
    o = n(140),
    s = n(13),
    a = n(68),
    l = n(112),
    u = {},
    c = {};
  (t = e.exports = function (e, t, n, d, f) {
    var h, p, v, g, m = f ? function () {
      return e
    } : l(e),
      y = i(n, d, t ? 2 : 1),
      b = 0;
    if ("function" != typeof m) throw TypeError(e + " is not iterable!");
    if (o(m)) {
      for (h = a(e.length); h > b; b++)
        if ((g = t ? y(s(p = e[b])[0], p[1]) : y(e[b])) === u || g === c) return g
    } else
      for (v = m.call(e); !(p = v.next()).done;)
        if ((g = r(v, y, p.value, t)) === u || g === c) return g
  }).BREAK = u, t.RETURN = c
}, , function (e, t, n) {
  "use strict";
  var i, r, o = n(106),
    s = RegExp.prototype.exec,
    a = String.prototype.replace,
    l = s,
    u = (i = /a/, r = /b*/g, s.call(i, "a"), s.call(r, "a"), 0 !== i.lastIndex || 0 !== r.lastIndex),
    c = void 0 !== /()??/.exec("")[1];
  (u || c) && (l = function exec(e) {
    var t, n, i, r, l = this;
    return c && (n = new RegExp("^" + l.source + "$(?!\\s)", o.call(l))), u && (t = l.lastIndex), i = s.call(l, e), u && i && (l.lastIndex = l.global ? i.index + i[0].length : t), c && i && i.length > 1 && a.call(i[0], n, (function () {
      for (r = 1; r < arguments.length - 2; r++) void 0 === arguments[r] && (i[r] = void 0)
    })), i
  }), e.exports = l
}, , , function (e, t) {
  e.exports = function (e) {
    if ("function" != typeof e) throw TypeError(e + " is not a function!");
    return e
  }
}, function (e, t, n) {
  var i = n(9),
    r = n(8).document,
    o = i(r) && i(r.createElement);
  e.exports = function (e) {
    return o ? r.createElement(e) : {}
  }
}, function (e, t, n) {
  e.exports = n(24)
}, function (e, t, n) {
  "use strict";
  var i = n(113),
    r = RegExp.prototype.exec;
  e.exports = function (e, t) {
    var n = e.exec;
    if ("function" == typeof n) {
      var o = n.call(e, t);
      if ("object" != typeof o) throw new TypeError("RegExp exec method returned something other than an Object or null");
      return o
    }
    if ("RegExp" !== i(e)) throw new TypeError("RegExp#exec called on incompatible receiver");
    return r.call(e, t)
  }
}, function (e, t, n) {
  "use strict";
  n(190);
  var i = n(35),
    r = n(29),
    o = n(33),
    s = n(42),
    a = n(12),
    l = n(88),
    u = a("species"),
    c = !o((function () {
      var e = /./;
      return e.exec = function () {
        var e = [];
        return e.groups = {
          a: "7"
        }, e
      }, "7" !== "".replace(e, "$<a>")
    })),
    d = function () {
      var e = /(?:)/,
        t = e.exec;
      e.exec = function () {
        return t.apply(this, arguments)
      };
      var n = "ab".split(e);
      return 2 === n.length && "a" === n[0] && "b" === n[1]
    }();
  e.exports = function (e, t, n) {
    var f = a(e),
      h = !o((function () {
        var t = {};
        return t[f] = function () {
          return 7
        }, 7 != ""[e](t)
      })),
      p = h ? !o((function () {
        var t = !1,
          n = /a/;
        return n.exec = function () {
          return t = !0, null
        }, "split" === e && (n.constructor = {}, n.constructor[u] = function () {
          return n
        }), n[f](""), !t
      })) : void 0;
    if (!h || !p || "replace" === e && !c || "split" === e && !d) {
      var v = /./[f],
        g = n(s, f, ""[e], (function maybeCallNative(e, t, n, i, r) {
          return t.exec === l ? h && !r ? {
            done: !0,
            value: v.call(t, n, i)
          } : {
              done: !0,
              value: e.call(n, t, i)
            } : {
              done: !1
            }
        })),
        m = g[0],
        y = g[1];
      i(String.prototype, e, m), r(RegExp.prototype, f, 2 == t ? function (e, t) {
        return y.call(e, this, t)
      } : function (e) {
        return y.call(e, this)
      })
    }
  }
}, function (e, t, n) {
  var i = n(42);
  e.exports = function (e) {
    return Object(i(e))
  }
}, function (e, t, n) {
  var i = n(56);
  e.exports = Array.isArray || function isArray(e) {
    return "Array" == i(e)
  }
}, function (e, t, n) {
  var i = n(120),
    r = n(42);
  e.exports = function (e) {
    return i(r(e))
  }
}, function (e, t, n) {
  var i = n(116),
    r = n(78).concat("length", "prototype");
  t.f = Object.getOwnPropertyNames || function getOwnPropertyNames(e) {
    return i(e, r)
  }
}, function (e, t) { }, function (e, t, n) {
  var i = n(56),
    r = n(10)("toStringTag"),
    o = "Arguments" == i(function () {
      return arguments
    }());
  e.exports = function (e) {
    var t, n, s;
    return void 0 === e ? "Undefined" : null === e ? "Null" : "string" == typeof (n = function (e, t) {
      try {
        return e[t]
      } catch (e) { }
    }(t = Object(e), r)) ? n : o ? i(t) : "Object" == (s = i(t)) && "function" == typeof t.callee ? "Arguments" : s
  }
}, function (e, t) {
  e.exports = function (e, t) {
    return {
      enumerable: !(1 & e),
      configurable: !(2 & e),
      writable: !(4 & e),
      value: t
    }
  }
}, function (e, t, n) {
  var i = n(56);
  e.exports = Object("z").propertyIsEnumerable(0) ? Object : function (e) {
    return "String" == i(e) ? e.split("") : Object(e)
  }
}, , function (e, t, n) {
  "use strict";
  var i = n(142)(!0);
  e.exports = function (e, t, n) {
    return t + (n ? i(e, t).length : 1)
  }
}, function (e, t, n) {
  "use strict";
  var i = n(18);
  e.exports = function () {
    var e = i(this),
      t = "";
    return e.global && (t += "g"), e.ignoreCase && (t += "i"), e.multiline && (t += "m"), e.unicode && (t += "u"), e.sticky && (t += "y"), t
  }
}, function (e, t, n) {
  e.exports = n(167)
}, function (e, t, n) {
  "use strict";
  var i = n(47),
    r = n(7),
    o = n(93),
    s = n(24),
    a = n(34),
    l = n(173),
    u = n(53),
    c = n(64),
    d = n(10)("iterator"),
    f = !([].keys && "next" in [].keys()),
    returnThis = function () {
      return this
    };
  e.exports = function (e, t, n, h, p, v, g) {
    l(n, t, h);
    var m, y, b, getMethod = function (e) {
      if (!f && e in k) return k[e];
      switch (e) {
        case "keys":
          return function keys() {
            return new n(this, e)
          };
        case "values":
          return function values() {
            return new n(this, e)
          }
      }
      return function entries() {
        return new n(this, e)
      }
    },
      _ = t + " Iterator",
      w = "values" == p,
      S = !1,
      k = e.prototype,
      x = k[d] || k["@@iterator"] || p && k[p],
      E = x || getMethod(p),
      C = p ? w ? getMethod("entries") : E : void 0,
      M = "Array" == t && k.entries || x;
    if (M && (b = c(M.call(new e))) !== Object.prototype && b.next && (u(b, _, !0), i || "function" == typeof b[d] || s(b, d, returnThis)), w && x && "values" !== x.name && (S = !0, E = function values() {
      return x.call(this)
    }), i && !g || !f && !S && k[d] || s(k, d, E), a[t] = E, a[_] = returnThis, p)
      if (m = {
        values: w ? E : getMethod("values"),
        keys: v ? E : getMethod("keys"),
        entries: C
      }, g)
        for (y in m) y in k || o(k, y, m[y]);
      else r(r.P + r.F * (f || S), t, m);
    return m
  }
}, function (e, t, n) {
  var i = n(30),
    r = n(17).document,
    o = i(r) && i(r.createElement);
  e.exports = function (e) {
    return o ? r.createElement(e) : {}
  }
}, function (e, t) {
  e.exports = !1
}, function (e, t, n) {
  e.exports = n(176)
}, function (e, t, n) {
  var i = n(101),
    r = n(10)("iterator"),
    o = n(34);
  e.exports = n(6).getIteratorMethod = function (e) {
    if (null != e) return e[r] || e["@@iterator"] || o[i(e)]
  }
}, function (e, t, n) {
  var i = n(46),
    r = n(12)("toStringTag"),
    o = "Arguments" == i(function () {
      return arguments
    }());
  e.exports = function (e) {
    var t, n, s;
    return void 0 === e ? "Undefined" : null === e ? "Null" : "string" == typeof (n = function (e, t) {
      try {
        return e[t]
      } catch (e) { }
    }(t = Object(e), r)) ? n : o ? i(t) : "Object" == (s = i(t)) && "function" == typeof t.callee ? "Arguments" : s
  }
}, function (e, t, n) {
  e.exports = !n(14) && !n(22)((function () {
    return 7 != Object.defineProperty(n(92)("div"), "a", {
      get: function () {
        return 7
      }
    }).a
  }))
}, function (e, t, n) {
  e.exports = n(160)
}, function (e, t, n) {
  var i = n(19),
    r = n(20),
    o = n(165)(!1),
    s = n(75)("IE_PROTO");
  e.exports = function (e, t) {
    var n, a = r(e),
      l = 0,
      u = [];
    for (n in a) n != s && i(a, n) && u.push(n);
    for (; t.length > l;) i(a, n = t[l++]) && (~o(u, n) || u.push(n));
    return u
  }
}, , , function (e, t, n) {
  "use strict";
  var i = n(18),
    r = n(43),
    o = n(105),
    s = n(94);
  n(95)("match", 1, (function (e, t, n, a) {
    return [function match(n) {
      var i = e(this),
        r = null == n ? void 0 : n[t];
      return void 0 !== r ? r.call(n, i) : new RegExp(n)[t](String(i))
    }, function (e) {
      var t = a(n, e, this);
      if (t.done) return t.value;
      var l = i(e),
        u = String(this);
      if (!l.global) return s(l, u);
      var c = l.unicode;
      l.lastIndex = 0;
      for (var d, f = [], h = 0; null !== (d = s(l, u));) {
        var p = String(d[0]);
        f[h] = p, "" === p && (l.lastIndex = o(u, r(l.lastIndex), c)), h++
      }
      return 0 === h ? null : f
    }]
  }))
}, function (e, t, n) {
  var i = n(46);
  e.exports = Object("z").propertyIsEnumerable(0) ? Object : function (e) {
    return "String" == i(e) ? e.split("") : Object(e)
  }
}, , function (e, t, n) {
  var i = n(30),
    r = n(46),
    o = n(12)("match");
  e.exports = function (e) {
    var t;
    return i(e) && (void 0 !== (t = e[o]) ? !!t : "RegExp" == r(e))
  }
}, function (e, t, n) {
  var i = n(30);
  e.exports = function (e, t) {
    if (!i(e)) return e;
    var n, r;
    if (t && "function" == typeof (n = e.toString) && !i(r = n.call(e))) return r;
    if ("function" == typeof (n = e.valueOf) && !i(r = n.call(e))) return r;
    if (!t && "function" == typeof (n = e.toString) && !i(r = n.call(e))) return r;
    throw TypeError("Can't convert object to primitive value")
  }
}, function (e, t, n) {
  e.exports = n(191)
}, function (e, t) {
  e.exports = function (e, t, n, i) {
    if (!(e instanceof t) || void 0 !== i && i in e) throw TypeError(n + ": incorrect invocation!");
    return e
  }
}, function (e, t, n) {
  var i = n(24);
  e.exports = function (e, t, n) {
    for (var r in t) n && e[r] ? e[r] = t[r] : i(e, r, t[r]);
    return e
  }
}, , , function (e, t, n) {
  e.exports = !n(27) && !n(33)((function () {
    return 7 != Object.defineProperty(n(109)("div"), "a", {
      get: function () {
        return 7
      }
    }).a
  }))
}, , function (e, t, n) {
  var i = n(8).document;
  e.exports = i && i.documentElement
}, function (e, t) {
  e.exports = function (e, t, n) {
    var i = void 0 === n;
    switch (t.length) {
      case 0:
        return i ? e() : e.call(n);
      case 1:
        return i ? e(t[0]) : e.call(n, t[0]);
      case 2:
        return i ? e(t[0], t[1]) : e.call(n, t[0], t[1]);
      case 3:
        return i ? e(t[0], t[1], t[2]) : e.call(n, t[0], t[1], t[2]);
      case 4:
        return i ? e(t[0], t[1], t[2], t[3]) : e.call(n, t[0], t[1], t[2], t[3])
    }
    return e.apply(n, t)
  }
}, function (e, t, n) {
  e.exports = n(257)
}, function (e, t, n) {
  var i = n(15),
    r = n(13),
    o = n(40);
  e.exports = n(14) ? Object.defineProperties : function defineProperties(e, t) {
    r(e);
    for (var n, s = o(t), a = s.length, l = 0; a > l;) i.f(e, n = s[l++], t[n]);
    return e
  }
}, function (e, t, n) {
  var i = n(115);

  function _setPrototypeOf(t, n) {
    return e.exports = _setPrototypeOf = i || function _setPrototypeOf(e, t) {
      return e.__proto__ = t, e
    }, _setPrototypeOf(t, n)
  }
  e.exports = _setPrototypeOf
}, , function (e, t, n) {
  e.exports = n(163)
}, function (e, t, n) {
  "use strict";
  var i = n(8),
    r = n(19),
    o = n(14),
    s = n(7),
    a = n(93),
    l = n(70).KEY,
    u = n(22),
    c = n(76),
    d = n(53),
    f = n(59),
    h = n(10),
    p = n(63),
    v = n(79),
    g = n(177),
    m = n(97),
    y = n(13),
    b = n(9),
    _ = n(32),
    w = n(20),
    S = n(74),
    k = n(44),
    x = n(52),
    E = n(178),
    C = n(51),
    M = n(71),
    $ = n(15),
    O = n(40),
    P = C.f,
    D = $.f,
    T = E.f,
    A = i.Symbol,
    j = i.JSON,
    I = j && j.stringify,
    L = h("_hidden"),
    V = h("toPrimitive"),
    H = {}.propertyIsEnumerable,
    R = c("symbol-registry"),
    B = c("symbols"),
    N = c("op-symbols"),
    z = Object.prototype,
    Q = "function" == typeof A && !!M.f,
    U = i.QObject,
    G = !U || !U.prototype || !U.prototype.findChild,
    K = o && u((function () {
      return 7 != x(D({}, "a", {
        get: function () {
          return D(this, "a", {
            value: 7
          }).a
        }
      })).a
    })) ? function (e, t, n) {
      var i = P(z, t);
      i && delete z[t], D(e, t, n), i && e !== z && D(z, t, i)
    } : D,
    wrap = function (e) {
      var t = B[e] = x(A.prototype);
      return t._k = e, t
    },
    q = Q && "symbol" == typeof A.iterator ? function (e) {
      return "symbol" == typeof e
    } : function (e) {
      return e instanceof A
    },
    W = function defineProperty(e, t, n) {
      return e === z && W(N, t, n), y(e), t = S(t, !0), y(n), r(B, t) ? (n.enumerable ? (r(e, L) && e[L][t] && (e[L][t] = !1), n = x(n, {
        enumerable: k(0, !1)
      })) : (r(e, L) || D(e, L, k(1, {})), e[L][t] = !0), K(e, t, n)) : D(e, t, n)
    },
    Z = function defineProperties(e, t) {
      y(e);
      for (var n, i = g(t = w(t)), r = 0, o = i.length; o > r;) W(e, n = i[r++], t[n]);
      return e
    },
    Y = function propertyIsEnumerable(e) {
      var t = H.call(this, e = S(e, !0));
      return !(this === z && r(B, e) && !r(N, e)) && (!(t || !r(this, e) || !r(B, e) || r(this, L) && this[L][e]) || t)
    },
    J = function getOwnPropertyDescriptor(e, t) {
      if (e = w(e), t = S(t, !0), e !== z || !r(B, t) || r(N, t)) {
        var n = P(e, t);
        return !n || !r(B, t) || r(e, L) && e[L][t] || (n.enumerable = !0), n
      }
    },
    X = function getOwnPropertyNames(e) {
      for (var t, n = T(w(e)), i = [], o = 0; n.length > o;) r(B, t = n[o++]) || t == L || t == l || i.push(t);
      return i
    },
    ee = function getOwnPropertySymbols(e) {
      for (var t, n = e === z, i = T(n ? N : w(e)), o = [], s = 0; i.length > s;) !r(B, t = i[s++]) || n && !r(z, t) || o.push(B[t]);
      return o
    };
  Q || (a((A = function Symbol() {
    if (this instanceof A) throw TypeError("Symbol is not a constructor!");
    var e = f(arguments.length > 0 ? arguments[0] : void 0),
      $set = function (t) {
        this === z && $set.call(N, t), r(this, L) && r(this[L], e) && (this[L][e] = !1), K(this, e, k(1, t))
      };
    return o && G && K(z, e, {
      configurable: !0,
      set: $set
    }), wrap(e)
  }).prototype, "toString", (function toString() {
    return this._k
  })), C.f = J, $.f = W, n(99).f = E.f = X, n(50).f = Y, M.f = ee, o && !n(47) && a(z, "propertyIsEnumerable", Y, !0), p.f = function (e) {
    return wrap(h(e))
  }), s(s.G + s.W + s.F * !Q, {
    Symbol: A
  });
  for (var te = "hasInstance,isConcatSpreadable,iterator,match,replace,search,species,split,toPrimitive,toStringTag,unscopables".split(","), ne = 0; te.length > ne;) h(te[ne++]);
  for (var ie = O(h.store), re = 0; ie.length > re;) v(ie[re++]);
  s(s.S + s.F * !Q, "Symbol", {
    for: function (e) {
      return r(R, e += "") ? R[e] : R[e] = A(e)
    },
    keyFor: function keyFor(e) {
      if (!q(e)) throw TypeError(e + " is not a symbol!");
      for (var t in R)
        if (R[t] === e) return t
    },
    useSetter: function () {
      G = !0
    },
    useSimple: function () {
      G = !1
    }
  }), s(s.S + s.F * !Q, "Object", {
    create: function create(e, t) {
      return void 0 === t ? x(e) : Z(x(e), t)
    },
    defineProperty: W,
    defineProperties: Z,
    getOwnPropertyDescriptor: J,
    getOwnPropertyNames: X,
    getOwnPropertySymbols: ee
  });
  var oe = u((function () {
    M.f(1)
  }));
  s(s.S + s.F * oe, "Object", {
    getOwnPropertySymbols: function getOwnPropertySymbols(e) {
      return M.f(_(e))
    }
  }), j && s(s.S + s.F * (!Q || u((function () {
    var e = A();
    return "[null]" != I([e]) || "{}" != I({
      a: e
    }) || "{}" != I(Object(e))
  }))), "JSON", {
    stringify: function stringify(e) {
      for (var t, n, i = [e], r = 1; arguments.length > r;) i.push(arguments[r++]);
      if (n = t = i[1], (b(t) || void 0 !== e) && !q(e)) return m(t) || (t = function (e, t) {
        if ("function" == typeof n && (t = n.call(this, e, t)), !q(t)) return t
      }), i[1] = t, I.apply(j, i)
    }
  }), A.prototype[V] || n(24)(A.prototype, V, A.prototype.valueOf), d(A, "Symbol"), d(Math, "Math", !0), d(i.JSON, "JSON", !0)
}, function (e, t, n) {
  var i = n(13);
  e.exports = function (e, t, n, r) {
    try {
      return r ? t(i(n)[0], n[1]) : t(n)
    } catch (t) {
      var o = e.return;
      throw void 0 !== o && i(o.call(e)), t
    }
  }
}, function (e, t, n) {
  var i = n(34),
    r = n(10)("iterator"),
    o = Array.prototype;
  e.exports = function (e) {
    return void 0 !== e && (i.Array === e || o[r] === e)
  }
}, function (e, t, n) {
  "use strict";
  var i = n(37),
    r = n(146)(!0);
  i(i.P, "Array", {
    includes: function includes(e) {
      return r(this, e, arguments.length > 1 ? arguments[1] : void 0)
    }
  }), n(85)("includes")
}, function (e, t, n) {
  var i = n(57),
    r = n(42);
  e.exports = function (e) {
    return function (t, n) {
      var o, s, a = String(r(t)),
        l = i(n),
        u = a.length;
      return l < 0 || l >= u ? e ? "" : void 0 : (o = a.charCodeAt(l)) < 55296 || o > 56319 || l + 1 === u || (s = a.charCodeAt(l + 1)) < 56320 || s > 57343 ? e ? a.charAt(l) : o : e ? a.slice(l, l + 2) : s - 56320 + (o - 55296 << 10) + 65536
    }
  }
}, function (e, t, n) {
  e.exports = n(66)("native-function-to-string", Function.toString)
}, function (e, t, n) {
  "use strict";
  var i = n(38);

  function PromiseCapability(e) {
    var t, n;
    this.promise = new e((function (e, i) {
      if (void 0 !== t || void 0 !== n) throw TypeError("Bad Promise constructor");
      t = e, n = i
    })), this.resolve = i(t), this.reject = i(n)
  }
  e.exports.f = function (e) {
    return new PromiseCapability(e)
  }
}, , function (e, t, n) {
  var i = n(98),
    r = n(43),
    o = n(198);
  e.exports = function (e) {
    return function (t, n, s) {
      var a, l = i(t),
        u = r(l.length),
        c = o(s, u);
      if (e && n != n) {
        for (; u > c;)
          if ((a = l[c++]) != a) return !0
      } else
        for (; u > c; c++)
          if ((e || c in l) && l[c] === n) return e || c || 0;
      return !e && -1
    }
  }
}, , function (e, t, n) {
  var i = n(107);
  e.exports = function _isNativeReflectConstruct() {
    if ("undefined" == typeof Reflect || !i) return !1;
    if (i.sham) return !1;
    if ("function" == typeof Proxy) return !0;
    try {
      return Date.prototype.toString.call(i(Date, [], (function () { }))), !0
    } catch (e) {
      return !1
    }
  }
}, function (e, t) {
  e.exports = function (e, t) {
    return {
      value: t,
      done: !!e
    }
  }
}, , function (e, t, n) {
  e.exports = n(171)
}, function (e, t, n) {
  var i = n(10)("iterator"),
    r = !1;
  try {
    var o = [7][i]();
    o.return = function () {
      r = !0
    }, Array.from(o, (function () {
      throw 2
    }))
  } catch (e) { }
  e.exports = function (e, t) {
    if (!t && !r) return !1;
    var n = !1;
    try {
      var o = [7],
        s = o[i]();
      s.next = function () {
        return {
          done: n = !0
        }
      }, o[i] = function () {
        return s
      }, e(o)
    } catch (e) { }
    return n
  }
}, , function (e, t, n) {
  var i = n(18),
    r = n(91),
    o = n(12)("species");
  e.exports = function (e, t) {
    var n, s = i(e).constructor;
    return void 0 === s || null == (n = i(s)[o]) ? t : r(n)
  }
}, function (e, t, n) {
  n(156);
  var i = n(6).Object;
  e.exports = function defineProperty(e, t, n) {
    return i.defineProperty(e, t, n)
  }
}, function (e, t, n) {
  var i = n(7);
  i(i.S + i.F * !n(14), "Object", {
    defineProperty: n(15).f
  })
}, function (e, t, n) {
  e.exports = n(158)
}, function (e, t, n) {
  n(159), e.exports = n(6).Object.getPrototypeOf
}, function (e, t, n) {
  var i = n(32),
    r = n(64);
  n(83)("getPrototypeOf", (function () {
    return function getPrototypeOf(e) {
      return r(i(e))
    }
  }))
}, function (e, t, n) {
  n(161), e.exports = n(6).Object.setPrototypeOf
}, function (e, t, n) {
  var i = n(7);
  i(i.S, "Object", {
    setPrototypeOf: n(162).set
  })
}, function (e, t, n) {
  var i = n(9),
    r = n(13),
    check = function (e, t) {
      if (r(e), !i(t) && null !== t) throw TypeError(t + ": can't set as prototype!")
    };
  e.exports = {
    set: Object.setPrototypeOf || ("__proto__" in {} ? function (e, t, i) {
      try {
        (i = n(31)(Function.call, n(51).f(Object.prototype, "__proto__").set, 2))(e, []), t = !(e instanceof Array)
      } catch (e) {
        t = !0
      }
      return function setPrototypeOf(e, n) {
        return check(e, n), t ? e.__proto__ = n : i(e, n), e
      }
    }({}, !1) : void 0),
    check: check
  }
}, function (e, t, n) {
  n(164);
  var i = n(6).Object;
  e.exports = function create(e, t) {
    return i.create(e, t)
  }
}, function (e, t, n) {
  var i = n(7);
  i(i.S, "Object", {
    create: n(52)
  })
}, function (e, t, n) {
  var i = n(20),
    r = n(68),
    o = n(166);
  e.exports = function (e) {
    return function (t, n, s) {
      var a, l = i(t),
        u = r(l.length),
        c = o(s, u);
      if (e && n != n) {
        for (; u > c;)
          if ((a = l[c++]) != a) return !0
      } else
        for (; u > c; c++)
          if ((e || c in l) && l[c] === n) return e || c || 0;
      return !e && -1
    }
  }
}, function (e, t, n) {
  var i = n(77),
    r = Math.max,
    o = Math.min;
  e.exports = function (e, t) {
    return (e = i(e)) < 0 ? r(e + t, 0) : o(e, t)
  }
}, function (e, t, n) {
  n(168), e.exports = n(6).Reflect.construct
}, function (e, t, n) {
  var i = n(7),
    r = n(52),
    o = n(38),
    s = n(13),
    a = n(9),
    l = n(22),
    u = n(169),
    c = (n(8).Reflect || {}).construct,
    d = l((function () {
      function F() { }
      return !(c((function () { }), [], F) instanceof F)
    })),
    f = !l((function () {
      c((function () { }))
    }));
  i(i.S + i.F * (d || f), "Reflect", {
    construct: function construct(e, t) {
      o(e), s(t);
      var n = arguments.length < 3 ? e : o(arguments[2]);
      if (f && !d) return c(e, t, n);
      if (e == n) {
        switch (t.length) {
          case 0:
            return new e;
          case 1:
            return new e(t[0]);
          case 2:
            return new e(t[0], t[1]);
          case 3:
            return new e(t[0], t[1], t[2]);
          case 4:
            return new e(t[0], t[1], t[2], t[3])
        }
        var i = [null];
        return i.push.apply(i, t), new (u.apply(e, i))
      }
      var l = n.prototype,
        h = r(a(l) ? l : Object.prototype),
        p = Function.apply.call(e, h, t);
      return a(p) ? p : h
    }
  })
}, function (e, t, n) {
  "use strict";
  var i = n(38),
    r = n(9),
    o = n(132),
    s = [].slice,
    a = {},
    construct = function (e, t, n) {
      if (!(t in a)) {
        for (var i = [], r = 0; r < t; r++) i[r] = "a[" + r + "]";
        a[t] = Function("F,a", "return new F(" + i.join(",") + ")")
      }
      return a[t](e, n)
    };
  e.exports = Function.bind || function bind(e) {
    var t = i(this),
      n = s.call(arguments, 1),
      bound = function () {
        var i = n.concat(s.call(arguments));
        return this instanceof bound ? construct(t, i.length, i) : o(t, i, e)
      };
    return r(t.prototype) && (bound.prototype = t.prototype), bound
  }
}, function (e, t, n) {
  var i = n(48),
    r = n(49);
  e.exports = function _possibleConstructorReturn(e, t) {
    return !t || "object" !== i(t) && "function" != typeof t ? r(e) : t
  }
}, function (e, t, n) {
  n(60), n(62), e.exports = n(63).f("iterator")
}, function (e, t, n) {
  var i = n(77),
    r = n(65);
  e.exports = function (e) {
    return function (t, n) {
      var o, s, a = String(r(t)),
        l = i(n),
        u = a.length;
      return l < 0 || l >= u ? e ? "" : void 0 : (o = a.charCodeAt(l)) < 55296 || o > 56319 || l + 1 === u || (s = a.charCodeAt(l + 1)) < 56320 || s > 57343 ? e ? a.charAt(l) : o : e ? a.slice(l, l + 2) : s - 56320 + (o - 55296 << 10) + 65536
    }
  }
}, function (e, t, n) {
  "use strict";
  var i = n(52),
    r = n(44),
    o = n(53),
    s = {};
  n(24)(s, n(10)("iterator"), (function () {
    return this
  })), e.exports = function (e, t, n) {
    e.prototype = i(s, {
      next: r(1, n)
    }), o(e, t + " Iterator")
  }
}, function (e, t, n) {
  "use strict";
  var i = n(175),
    r = n(149),
    o = n(34),
    s = n(20);
  e.exports = n(108)(Array, "Array", (function (e, t) {
    this._t = s(e), this._i = 0, this._k = t
  }), (function () {
    var e = this._t,
      t = this._k,
      n = this._i++;
    return !e || n >= e.length ? (this._t = void 0, r(1)) : r(0, "keys" == t ? n : "values" == t ? e[n] : [n, e[n]])
  }), "values"), o.Arguments = o.Array, i("keys"), i("values"), i("entries")
}, function (e, t) {
  e.exports = function () { }
}, function (e, t, n) {
  n(138), n(100), n(179), n(180), e.exports = n(6).Symbol
}, function (e, t, n) {
  var i = n(40),
    r = n(71),
    o = n(50);
  e.exports = function (e) {
    var t = i(e),
      n = r.f;
    if (n)
      for (var s, a = n(e), l = o.f, u = 0; a.length > u;) l.call(e, s = a[u++]) && t.push(s);
    return t
  }
}, function (e, t, n) {
  var i = n(20),
    r = n(99).f,
    o = {}.toString,
    s = "object" == typeof window && window && Object.getOwnPropertyNames ? Object.getOwnPropertyNames(window) : [];
  e.exports.f = function getOwnPropertyNames(e) {
    return s && "[object Window]" == o.call(e) ? function (e) {
      try {
        return r(e)
      } catch (e) {
        return s.slice()
      }
    }(e) : r(i(e))
  }
}, function (e, t, n) {
  n(79)("asyncIterator")
}, function (e, t, n) {
  n(79)("observable")
}, function (e, t, n) {
  var i = n(73),
    r = n(120),
    o = n(96),
    s = n(43),
    a = n(216);
  e.exports = function (e, t) {
    var n = 1 == e,
      l = 2 == e,
      u = 3 == e,
      c = 4 == e,
      d = 6 == e,
      f = 5 == e || d,
      h = t || a;
    return function (t, a, p) {
      for (var v, g, m = o(t), y = r(m), b = i(a, p, 3), _ = s(y.length), w = 0, S = n ? h(t, _) : l ? h(t, 0) : void 0; _ > w; w++)
        if ((f || w in y) && (g = b(v = y[w], w, m), e))
          if (n) S[w] = g;
          else if (g) switch (e) {
            case 3:
              return !0;
            case 5:
              return v;
            case 6:
              return w;
            case 2:
              S.push(v)
          } else if (c) return !1;
      return d ? -1 : u || c ? c : S
    }
  }
}, function (e, t, n) {
  "use strict";
  n(279);
  var i = n(18),
    r = n(106),
    o = n(27),
    s = /./.toString,
    define = function (e) {
      n(35)(RegExp.prototype, "toString", e, !0)
    };
  n(33)((function () {
    return "/a/b" != s.call({
      source: "a",
      flags: "b"
    })
  })) ? define((function toString() {
    var e = i(this);
    return "/".concat(e.source, "/", "flags" in e ? e.flags : !o && e instanceof RegExp ? r.call(e) : void 0)
  })) : "toString" != s.name && define((function toString() {
    return s.call(this)
  }))
}, , function (e, t, n) {
  var i = n(14),
    r = n(40),
    o = n(20),
    s = n(50).f;
  e.exports = function (e) {
    return function (t) {
      for (var n, a = o(t), l = r(a), u = l.length, c = 0, d = []; u > c;) n = l[c++], i && !s.call(a, n) || d.push(e ? [n, a[n]] : a[n]);
      return d
    }
  }
}, , , , function (e, t, n) {
  "use strict";
  var i = n(37),
    r = n(213);
  i(i.P + i.F * n(214)("includes"), "String", {
    includes: function includes(e) {
      return !!~r(this, e, "includes").indexOf(e, arguments.length > 1 ? arguments[1] : void 0)
    }
  })
}, , function (e, t, n) {
  "use strict";
  var i = n(88);
  n(37)({
    target: "RegExp",
    proto: !0,
    forced: i !== /./.exec
  }, {
    exec: i
  })
}, function (e, t, n) {
  n(192);
  var i = n(6).Object;
  e.exports = function getOwnPropertyDescriptor(e, t) {
    return i.getOwnPropertyDescriptor(e, t)
  }
}, function (e, t, n) {
  var i = n(20),
    r = n(51).f;
  n(83)("getOwnPropertyDescriptor", (function () {
    return function getOwnPropertyDescriptor(e, t) {
      return r(i(e), t)
    }
  }))
}, function (e, t, n) {
  e.exports = n(194)
}, function (e, t, n) {
  n(195), e.exports = n(6).Reflect.get
}, function (e, t, n) {
  var i = n(51),
    r = n(64),
    o = n(19),
    s = n(7),
    a = n(9),
    l = n(13);
  s(s.S, "Reflect", {
    get: function get(e, t) {
      var n, s, u = arguments.length < 3 ? e : arguments[2];
      return l(e) === u ? e[t] : (n = i.f(e, t)) ? o(n, "value") ? n.value : void 0 !== n.get ? n.get.call(u) : void 0 : a(s = r(e)) ? get(s, t, u) : void 0
    }
  })
}, function (e, t, n) {
  var i = n(16);
  e.exports = function _superPropBase(e, t) {
    for (; !Object.prototype.hasOwnProperty.call(e, t) && null !== (e = i(e)););
    return e
  }
}, , function (e, t, n) {
  var i = n(57),
    r = Math.max,
    o = Math.min;
  e.exports = function (e, t) {
    return (e = i(e)) < 0 ? r(e + t, 0) : o(e, t)
  }
}, , , function (e, t, n) {
  n(202), e.exports = n(6).Object.keys
}, function (e, t, n) {
  var i = n(32),
    r = n(40);
  n(83)("keys", (function () {
    return function keys(e) {
      return r(i(e))
    }
  }))
}, , function (e, t, n) {
  e.exports = n(316)
}, function (e, t, n) {
  var i = n(13),
    r = n(38),
    o = n(10)("species");
  e.exports = function (e, t) {
    var n, s = i(e).constructor;
    return void 0 === s || null == (n = i(s)[o]) ? t : r(n)
  }
}, function (e, t, n) {
  var i, r, o, s = n(31),
    a = n(132),
    l = n(131),
    u = n(92),
    c = n(8),
    d = c.process,
    f = c.setImmediate,
    h = c.clearImmediate,
    p = c.MessageChannel,
    v = c.Dispatch,
    g = 0,
    m = {},
    run = function () {
      var e = +this;
      if (m.hasOwnProperty(e)) {
        var t = m[e];
        delete m[e], t()
      }
    },
    listener = function (e) {
      run.call(e.data)
    };
  f && h || (f = function setImmediate(e) {
    for (var t = [], n = 1; arguments.length > n;) t.push(arguments[n++]);
    return m[++g] = function () {
      a("function" == typeof e ? e : Function(e), t)
    }, i(g), g
  }, h = function clearImmediate(e) {
    delete m[e]
  }, "process" == n(56)(d) ? i = function (e) {
    d.nextTick(s(run, e, 1))
  } : v && v.now ? i = function (e) {
    v.now(s(run, e, 1))
  } : p ? (o = (r = new p).port2, r.port1.onmessage = listener, i = s(o.postMessage, o, 1)) : c.addEventListener && "function" == typeof postMessage && !c.importScripts ? (i = function (e) {
    c.postMessage(e + "", "*")
  }, c.addEventListener("message", listener, !1)) : i = "onreadystatechange" in u("script") ? function (e) {
    l.appendChild(u("script")).onreadystatechange = function () {
      l.removeChild(this), run.call(e)
    }
  } : function (e) {
    setTimeout(s(run, e, 1), 0)
  }), e.exports = {
    set: f,
    clear: h
  }
}, function (e, t) {
  e.exports = function (e) {
    try {
      return {
        e: !1,
        v: e()
      }
    } catch (e) {
      return {
        e: !0,
        v: e
      }
    }
  }
}, function (e, t, n) {
  var i = n(13),
    r = n(9),
    o = n(144);
  e.exports = function (e, t) {
    if (i(e), r(t) && t.constructor === e) return t;
    var n = o.f(e);
    return (0, n.resolve)(t), n.promise
  }
}, , , function (e, t, n) {
  e.exports = n(281)
}, , function (e, t, n) {
  var i = n(122),
    r = n(42);
  e.exports = function (e, t, n) {
    if (i(t)) throw TypeError("String#" + n + " doesn't accept regex!");
    return String(r(e))
  }
}, function (e, t, n) {
  var i = n(12)("match");
  e.exports = function (e) {
    var t = /./;
    try {
      "/./"[e](t)
    } catch (n) {
      try {
        return t[i] = !1, !"/./"[e](t)
      } catch (e) { }
    }
    return !0
  }
}, , function (e, t, n) {
  var i = n(217);
  e.exports = function (e, t) {
    return new (i(e))(t)
  }
}, function (e, t, n) {
  var i = n(30),
    r = n(218),
    o = n(12)("species");
  e.exports = function (e) {
    var t;
    return r(e) && ("function" != typeof (t = e.constructor) || t !== Array && !r(t.prototype) || (t = void 0), i(t) && null === (t = t[o]) && (t = void 0)), void 0 === t ? Array : t
  }
}, function (e, t, n) {
  var i = n(46);
  e.exports = Array.isArray || function isArray(e) {
    return "Array" == i(e)
  }
}, , , , , , , function (e, t, n) {
  "use strict";
  var i = n(8),
    r = n(6),
    o = n(15),
    s = n(14),
    a = n(10)("species");
  e.exports = function (e) {
    var t = "function" == typeof r[e] ? r[e] : i[e];
    s && t && !t[a] && o.f(t, a, {
      configurable: !0,
      get: function () {
        return this
      }
    })
  }
}, , , , , , , , , , function (e, t) {
  e.exports = "\t\n\v\f\r   ᠎             　\u2028\u2029\ufeff"
}, , , , function (e, t, n) {
  n(240), e.exports = n(6).Object.values
}, function (e, t, n) {
  var i = n(7),
    r = n(184)(!1);
  i(i.S, "Object", {
    values: function values(e) {
      return r(e)
    }
  })
}, , , , , , , , , , , , , , , , , function (e, t, n) {
  n(100), n(60), n(62), n(258), n(261), n(262), e.exports = n(6).Promise
}, function (e, t, n) {
  "use strict";
  var i, r, o, s, a = n(47),
    l = n(8),
    u = n(31),
    c = n(101),
    d = n(7),
    f = n(9),
    h = n(38),
    p = n(125),
    v = n(86),
    g = n(205),
    m = n(206).set,
    y = n(259)(),
    b = n(144),
    _ = n(207),
    w = n(260),
    S = n(208),
    k = l.TypeError,
    x = l.process,
    E = x && x.versions,
    C = E && E.v8 || "",
    M = l.Promise,
    $ = "process" == c(x),
    empty = function () { },
    O = r = b.f,
    P = !! function () {
      try {
        var e = M.resolve(1),
          t = (e.constructor = {})[n(10)("species")] = function (e) {
            e(empty, empty)
          };
        return ($ || "function" == typeof PromiseRejectionEvent) && e.then(empty) instanceof t && 0 !== C.indexOf("6.6") && -1 === w.indexOf("Chrome/66")
      } catch (e) { }
    }(),
    isThenable = function (e) {
      var t;
      return !(!f(e) || "function" != typeof (t = e.then)) && t
    },
    notify = function (e, t) {
      if (!e._n) {
        e._n = !0;
        var n = e._c;
        y((function () {
          for (var i = e._v, r = 1 == e._s, o = 0, run = function (t) {
            var n, o, s, a = r ? t.ok : t.fail,
              l = t.resolve,
              u = t.reject,
              c = t.domain;
            try {
              a ? (r || (2 == e._h && onHandleUnhandled(e), e._h = 1), !0 === a ? n = i : (c && c.enter(), n = a(i), c && (c.exit(), s = !0)), n === t.promise ? u(k("Promise-chain cycle")) : (o = isThenable(n)) ? o.call(n, l, u) : l(n)) : u(i)
            } catch (e) {
              c && !s && c.exit(), u(e)
            }
          }; n.length > o;) run(n[o++]);
          e._c = [], e._n = !1, t && !e._h && onUnhandled(e)
        }))
      }
    },
    onUnhandled = function (e) {
      m.call(l, (function () {
        var t, n, i, r = e._v,
          o = isUnhandled(e);
        if (o && (t = _((function () {
          $ ? x.emit("unhandledRejection", r, e) : (n = l.onunhandledrejection) ? n({
            promise: e,
            reason: r
          }) : (i = l.console) && i.error && i.error("Unhandled promise rejection", r)
        })), e._h = $ || isUnhandled(e) ? 2 : 1), e._a = void 0, o && t.e) throw t.v
      }))
    },
    isUnhandled = function (e) {
      return 1 !== e._h && 0 === (e._a || e._c).length
    },
    onHandleUnhandled = function (e) {
      m.call(l, (function () {
        var t;
        $ ? x.emit("rejectionHandled", e) : (t = l.onrejectionhandled) && t({
          promise: e,
          reason: e._v
        })
      }))
    },
    $reject = function (e) {
      var t = this;
      t._d || (t._d = !0, (t = t._w || t)._v = e, t._s = 2, t._a || (t._a = t._c.slice()), notify(t, !0))
    },
    $resolve = function (e) {
      var t, n = this;
      if (!n._d) {
        n._d = !0, n = n._w || n;
        try {
          if (n === e) throw k("Promise can't be resolved itself");
          (t = isThenable(e)) ? y((function () {
            var i = {
              _w: n,
              _d: !1
            };
            try {
              t.call(e, u($resolve, i, 1), u($reject, i, 1))
            } catch (e) {
              $reject.call(i, e)
            }
          })) : (n._v = e, n._s = 1, notify(n, !1))
        } catch (e) {
          $reject.call({
            _w: n,
            _d: !1
          }, e)
        }
      }
    };
  P || (M = function Promise(e) {
    p(this, M, "Promise", "_h"), h(e), i.call(this);
    try {
      e(u($resolve, this, 1), u($reject, this, 1))
    } catch (e) {
      $reject.call(this, e)
    }
  }, (i = function Promise(e) {
    this._c = [], this._a = void 0, this._s = 0, this._d = !1, this._v = void 0, this._h = 0, this._n = !1
  }).prototype = n(126)(M.prototype, {
    then: function then(e, t) {
      var n = O(g(this, M));
      return n.ok = "function" != typeof e || e, n.fail = "function" == typeof t && t, n.domain = $ ? x.domain : void 0, this._c.push(n), this._a && this._a.push(n), this._s && notify(this, !1), n.promise
    },
    catch: function (e) {
      return this.then(void 0, e)
    }
  }), o = function () {
    var e = new i;
    this.promise = e, this.resolve = u($resolve, e, 1), this.reject = u($reject, e, 1)
  }, b.f = O = function (e) {
    return e === M || e === s ? new o(e) : r(e)
  }), d(d.G + d.W + d.F * !P, {
    Promise: M
  }), n(53)(M, "Promise"), n(225)("Promise"), s = n(6).Promise, d(d.S + d.F * !P, "Promise", {
    reject: function reject(e) {
      var t = O(this);
      return (0, t.reject)(e), t.promise
    }
  }), d(d.S + d.F * (a || !P), "Promise", {
    resolve: function resolve(e) {
      return S(a && this === s ? M : this, e)
    }
  }), d(d.S + d.F * !(P && n(152)((function (e) {
    M.all(e).catch(empty)
  }))), "Promise", {
    all: function all(e) {
      var t = this,
        n = O(t),
        i = n.resolve,
        r = n.reject,
        o = _((function () {
          var n = [],
            o = 0,
            s = 1;
          v(e, !1, (function (e) {
            var a = o++,
              l = !1;
            n.push(void 0), s++, t.resolve(e).then((function (e) {
              l || (l = !0, n[a] = e, --s || i(n))
            }), r)
          })), --s || i(n)
        }));
      return o.e && r(o.v), n.promise
    },
    race: function race(e) {
      var t = this,
        n = O(t),
        i = n.reject,
        r = _((function () {
          v(e, !1, (function (e) {
            t.resolve(e).then(n.resolve, i)
          }))
        }));
      return r.e && i(r.v), n.promise
    }
  })
}, function (e, t, n) {
  var i = n(8),
    r = n(206).set,
    o = i.MutationObserver || i.WebKitMutationObserver,
    s = i.process,
    a = i.Promise,
    l = "process" == n(56)(s);
  e.exports = function () {
    var e, t, n, flush = function () {
      var i, r;
      for (l && (i = s.domain) && i.exit(); e;) {
        r = e.fn, e = e.next;
        try {
          r()
        } catch (i) {
          throw e ? n() : t = void 0, i
        }
      }
      t = void 0, i && i.enter()
    };
    if (l) n = function () {
      s.nextTick(flush)
    };
    else if (!o || i.navigator && i.navigator.standalone)
      if (a && a.resolve) {
        var u = a.resolve(void 0);
        n = function () {
          u.then(flush)
        }
      } else n = function () {
        r.call(i, flush)
      };
    else {
      var c = !0,
        d = document.createTextNode("");
      new o(flush).observe(d, {
        characterData: !0
      }), n = function () {
        d.data = c = !c
      }
    }
    return function (i) {
      var r = {
        fn: i,
        next: void 0
      };
      t && (t.next = r), e || (e = r, n()), t = r
    }
  }
}, function (e, t, n) {
  var i = n(8).navigator;
  e.exports = i && i.userAgent || ""
}, function (e, t, n) {
  "use strict";
  var i = n(7),
    r = n(6),
    o = n(8),
    s = n(205),
    a = n(208);
  i(i.P + i.R, "Promise", {
    finally: function (e) {
      var t = s(this, r.Promise || o.Promise),
        n = "function" == typeof e;
      return this.then(n ? function (n) {
        return a(t, e()).then((function () {
          return n
        }))
      } : e, n ? function (n) {
        return a(t, e()).then((function () {
          throw n
        }))
      } : e)
    }
  })
}, function (e, t, n) {
  "use strict";
  var i = n(7),
    r = n(144),
    o = n(207);
  i(i.S, "Promise", {
    try: function (e) {
      var t = r.f(this),
        n = o(e);
      return (n.e ? t.reject : t.resolve)(n.v), t.promise
    }
  })
}, , , , , , , , , , function (e, t, n) {
  "use strict";
  n(1)(t, "__esModule", {
    value: !0
  }), t.default = void 0;
  var i = navigator.userAgent,
    r = {
      webkit: -1 !== i.indexOf("AppleWebKit"),
      firefox: -1 !== i.indexOf("Firefox"),
      ie: /Trident|MSIE/.test(i),
      edge: -1 !== i.indexOf("Edge"),
      mac: -1 !== i.indexOf("Macintosh"),
      safari: /^((?!chrome|android).)*safari/i.test(i)
    };
  t.default = r
}, , , , , , , function (e, t, n) {
  n(27) && "g" != /./g.flags && n(45).f(RegExp.prototype, "flags", {
    configurable: !0,
    get: n(106)
  })
}, , function (e, t, n) {
  n(282), e.exports = n(6).parseInt
}, function (e, t, n) {
  var i = n(7),
    r = n(283);
  i(i.G + i.F * (parseInt != r), {
    parseInt: r
  })
}, function (e, t, n) {
  var i = n(8).parseInt,
    r = n(284).trim,
    o = n(235),
    s = /^[-+]?0[xX]/;
  e.exports = 8 !== i(o + "08") || 22 !== i(o + "0x16") ? function parseInt(e, t) {
    var n = r(String(e), 3);
    return i(n, t >>> 0 || (s.test(n) ? 16 : 10))
  } : i
}, function (e, t, n) {
  var i = n(7),
    r = n(65),
    o = n(22),
    s = n(235),
    a = "[" + s + "]",
    l = RegExp("^" + a + a + "*"),
    u = RegExp(a + a + "*$"),
    exporter = function (e, t, n) {
      var r = {},
        a = o((function () {
          return !!s[e]() || "​" != "​"[e]()
        })),
        l = r[e] = a ? t(c) : s[e];
      n && (r[n] = l), i(i.P + i.F * a, "String", r)
    },
    c = exporter.trim = function (e, t) {
      return e = String(r(e)), 1 & t && (e = e.replace(l, "")), 2 & t && (e = e.replace(u, "")), e
    };
  e.exports = exporter
}, , , , , function (e, t, n) {
  e.exports = n(290)
}, function (e, t, n) {
  n(291);
  var i = n(6).Object;
  e.exports = function defineProperties(e, t) {
    return i.defineProperties(e, t)
  }
}, function (e, t, n) {
  var i = n(7);
  i(i.S + i.F * !n(14), "Object", {
    defineProperties: n(134)
  })
}, , , , , , , , , , , function (e, t, n) {
  "use strict";
  var i = n(37),
    r = n(181)(6),
    o = "findIndex",
    s = !0;
  o in [] && Array(1)[o]((function () {
    s = !1
  })), i(i.P + i.F * s, "Array", {
    findIndex: function findIndex(e) {
      return r(this, e, arguments.length > 1 ? arguments[1] : void 0)
    }
  }), n(85)(o)
}, , , , , , , , , , , , , , function (e, t, n) {
  var i = n(6),
    r = i.JSON || (i.JSON = {
      stringify: JSON.stringify
    });
  e.exports = function stringify(e) {
    return r.stringify.apply(r, arguments)
  }
}, , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , function (e, t, n) {
  "use strict";
  var i = n(0)(n(211));
  e.exports = function EventManager() {
    var e, t = Array.prototype.slice,
      n = {
        actions: {},
        filters: {}
      };

    function _removeHook(e, t, i, r) {
      var o, s, a;
      if (n[e][t])
        if (i)
          if (o = n[e][t], r)
            for (a = o.length; a--;)(s = o[a]).callback === i && s.context === r && o.splice(a, 1);
          else
            for (a = o.length; a--;) o[a].callback === i && o.splice(a, 1);
        else n[e][t] = []
    }

    function _addHook(e, t, i, r, o) {
      var s = {
        callback: i,
        priority: r,
        context: o
      },
        a = n[e][t];
      if (a) {
        var l = !1;
        if (jQuery.each(a, (function () {
          if (this.callback === i) return l = !0, !1
        })), l) return;
        a.push(s), a = function _hookInsertSort(e) {
          for (var t, n, i, r = 1, o = e.length; r < o; r++) {
            for (t = e[r], n = r;
              (i = e[n - 1]) && i.priority > t.priority;) e[n] = e[n - 1], --n;
            e[n] = t
          }
          return e
        }(a)
      } else a = [s];
      n[e][t] = a
    }

    function _runHook(e, t, i) {
      var r, o, s = n[e][t];
      if (!s) return "filters" === e && i[0];
      if (o = s.length, "filters" === e)
        for (r = 0; r < o; r++) i[0] = s[r].callback.apply(s[r].context, i);
      else
        for (r = 0; r < o; r++) s[r].callback.apply(s[r].context, i);
      return "filters" !== e || i[0]
    }
    return e = {
      removeFilter: function removeFilter(t, n) {
        return "string" == typeof t && _removeHook("filters", t, n), e
      },
      applyFilters: function applyFilters() {
        var n = t.call(arguments),
          i = n.shift();
        return "string" == typeof i ? _runHook("filters", i, n) : e
      },
      addFilter: function addFilter(t, n, r, o) {
        return "string" == typeof t && "function" == typeof n && _addHook("filters", t, n, r = (0, i.default)(r || 10, 10), o), e
      },
      removeAction: function removeAction(t, n) {
        return "string" == typeof t && _removeHook("actions", t, n), e
      },
      doAction: function doAction() {
        var n = t.call(arguments),
          i = n.shift();
        return "string" == typeof i && _runHook("actions", i, n), e
      },
      addAction: function addAction(t, n, r, o) {
        return "string" == typeof t && "function" == typeof n && _addHook("actions", t, n, r = (0, i.default)(r || 10, 10), o), e
      }
    }
  }
}, , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , function (e, t, n) {
  "use strict";
  var i = n(0);
  n(1)(t, "__esModule", {
    value: !0
  }), t.default = void 0;
  var r = i(n(204)),
    o = i(n(23)),
    s = i(n(2)),
    a = i(n(3)),
    l = i(n(4)),
    u = i(n(5)),
    c = function (e) {
      (0, l.default)(_default, e);
      var t = (0, u.default)(_default);

      function _default() {
        return (0, s.default)(this, _default), t.apply(this, arguments)
      }
      return (0, a.default)(_default, [{
        key: "get",
        value: function get(e, t) {
          var n;
          t = t || {};
          try {
            n = t.session ? sessionStorage : localStorage
          } catch (t) {
            return e ? void 0 : {}
          }
          var i = n.getItem("elementor");
          (i = i ? JSON.parse(i) : {}).__expiration || (i.__expiration = {});
          var r = i.__expiration,
            s = [];
          e ? r[e] && (s = [e]) : s = (0, o.default)(r);
          var a = !1;
          return s.forEach((function (e) {
            new Date(r[e]) < new Date && (delete i[e], delete r[e], a = !0)
          })), a && this.save(i, t.session), e ? i[e] : i
        }
      }, {
        key: "set",
        value: function set(e, t, n) {
          n = n || {};
          var i = this.get(null, n);
          if (i[e] = t, n.lifetimeInSeconds) {
            var r = new Date;
            r.setTime(r.getTime() + 1e3 * n.lifetimeInSeconds), i.__expiration[e] = r.getTime()
          }
          this.save(i, n.session)
        }
      }, {
        key: "save",
        value: function save(e, t) {
          var n;
          try {
            n = t ? sessionStorage : localStorage
          } catch (e) {
            return
          }
          n.setItem("elementor", (0, r.default)(e))
        }
      }]), _default
    }(elementorModules.Module);
  t.default = c
}, , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , function (e, t, n) {
  "use strict";
  var i = n(0);
  n(1)(t, "__esModule", {
    value: !0
  }), t.default = void 0, n(26);
  var r = i(n(2)),
    o = i(n(3)),
    s = i(n(25)),
    a = i(n(16)),
    l = i(n(4)),
    u = i(n(5)),
    c = function (e) {
      (0, l.default)(_default, e);
      var t = (0, u.default)(_default);

      function _default() {
        return (0, r.default)(this, _default), t.apply(this, arguments)
      }
      return (0, o.default)(_default, [{
        key: "getDefaultSettings",
        value: function getDefaultSettings() {
          return {
            selectors: {
              elements: ".elementor-element",
              nestedDocumentElements: ".elementor .elementor-element"
            },
            classes: {
              editMode: "elementor-edit-mode"
            }
          }
        }
      }, {
        key: "getDefaultElements",
        value: function getDefaultElements() {
          var e = this.getSettings("selectors");
          return {
            $elements: this.$element.find(e.elements).not(this.$element.find(e.nestedDocumentElements))
          }
        }
      }, {
        key: "getDocumentSettings",
        value: function getDocumentSettings(e) {
          var t;
          if (this.isEdit) {
            t = {};
            var n = elementor.settings.page.model;
            jQuery.each(n.getActiveControls(), (function (e) {
              t[e] = n.attributes[e]
            }))
          } else t = this.$element.data("elementor-settings") || {};
          return this.getItems(t, e)
        }
      }, {
        key: "runElementsHandlers",
        value: function runElementsHandlers() {
          this.elements.$elements.each((function (e, t) {
            return elementorFrontend.elementsHandler.runReadyTrigger(t)
          }))
        }
      }, {
        key: "onInit",
        value: function onInit() {
          var e = this;
          this.$element = this.getSettings("$element"), (0, s.default)((0, a.default)(_default.prototype), "onInit", this).call(this), this.isEdit = this.$element.hasClass(this.getSettings("classes.editMode")), this.isEdit ? elementor.on("document:loaded", (function () {
            elementor.settings.page.model.on("change", e.onSettingsChange.bind(e))
          })) : this.runElementsHandlers()
        }
      }, {
        key: "onSettingsChange",
        value: function onSettingsChange() { }
      }]), _default
    }(elementorModules.ViewModule);
  t.default = c
}, function (e, t, n) {
  "use strict";
  var i = n(0);
  n(1)(t, "__esModule", {
    value: !0
  }), t.default = void 0;
  var r = i(n(2)),
    o = i(n(3)),
    s = i(n(25)),
    a = i(n(16)),
    l = i(n(4)),
    u = i(n(5)),
    c = function (e) {
      (0, l.default)(baseTabs, e);
      var t = (0, u.default)(baseTabs);

      function baseTabs() {
        return (0, r.default)(this, baseTabs), t.apply(this, arguments)
      }
      return (0, o.default)(baseTabs, [{
        key: "getDefaultSettings",
        value: function getDefaultSettings() {
          return {
            selectors: {
              tabTitle: ".elementor-tab-title",
              tabContent: ".elementor-tab-content"
            },
            classes: {
              active: "elementor-active"
            },
            showTabFn: "show",
            hideTabFn: "hide",
            toggleSelf: !0,
            hidePrevious: !0,
            autoExpand: !0
          }
        }
      }, {
        key: "getDefaultElements",
        value: function getDefaultElements() {
          var e = this.getSettings("selectors");
          return {
            $tabTitles: this.findElement(e.tabTitle),
            $tabContents: this.findElement(e.tabContent)
          }
        }
      }, {
        key: "activateDefaultTab",
        value: function activateDefaultTab() {
          var e = this.getSettings();
          if (e.autoExpand && ("editor" !== e.autoExpand || this.isEdit)) {
            var t = this.getEditSettings("activeItemIndex") || 1,
              n = {
                showTabFn: e.showTabFn,
                hideTabFn: e.hideTabFn
              };
            this.setSettings({
              showTabFn: "show",
              hideTabFn: "hide"
            }), this.changeActiveTab(t), this.setSettings(n)
          }
        }
      }, {
        key: "deactivateActiveTab",
        value: function deactivateActiveTab(e) {
          var t = this.getSettings(),
            n = t.classes.active,
            i = e ? '[data-tab="' + e + '"]' : "." + n,
            r = this.elements.$tabTitles.filter(i),
            o = this.elements.$tabContents.filter(i);
          r.add(o).removeClass(n), o[t.hideTabFn]()
        }
      }, {
        key: "activateTab",
        value: function activateTab(e) {
          var t = this.getSettings(),
            n = t.classes.active,
            i = this.elements.$tabTitles.filter('[data-tab="' + e + '"]'),
            r = this.elements.$tabContents.filter('[data-tab="' + e + '"]');
          i.add(r).addClass(n), r[t.showTabFn]()
        }
      }, {
        key: "isActiveTab",
        value: function isActiveTab(e) {
          return this.elements.$tabTitles.filter('[data-tab="' + e + '"]').hasClass(this.getSettings("classes.active"))
        }
      }, {
        key: "bindEvents",
        value: function bindEvents() {
          var e = this;
          this.elements.$tabTitles.on({
            keydown: function keydown(t) {
              "Enter" === t.key && (t.preventDefault(), e.changeActiveTab(t.currentTarget.getAttribute("data-tab")))
            },
            click: function click(t) {
              t.preventDefault(), e.changeActiveTab(t.currentTarget.getAttribute("data-tab"))
            }
          })
        }
      }, {
        key: "onInit",
        value: function onInit() {
          for (var e, t = arguments.length, n = new Array(t), i = 0; i < t; i++) n[i] = arguments[i];
          (e = (0, s.default)((0, a.default)(baseTabs.prototype), "onInit", this)).call.apply(e, [this].concat(n)), this.activateDefaultTab()
        }
      }, {
        key: "onEditSettingsChange",
        value: function onEditSettingsChange(e) {
          "activeItemIndex" === e && this.activateDefaultTab()
        }
      }, {
        key: "changeActiveTab",
        value: function changeActiveTab(e) {
          var t = this.isActiveTab(e),
            n = this.getSettings();
          !n.toggleSelf && t || !n.hidePrevious || this.deactivateActiveTab(), !n.hidePrevious && t && this.deactivateActiveTab(e), t || this.activateTab(e)
        }
      }]), baseTabs
    }(elementorModules.frontend.handlers.Base);
  t.default = c
}, , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , function (e, t, n) {
  "use strict";
  var i = n(0);
  n(1)(t, "__esModule", {
    value: !0
  }), t.default = void 0, n(119);
  var r = i(n(2)),
    o = i(n(3)),
    s = i(n(4)),
    a = i(n(5)),
    l = function (e) {
      (0, s.default)(BaseLoader, e);
      var t = (0, a.default)(BaseLoader);

      function BaseLoader() {
        return (0, r.default)(this, BaseLoader), t.apply(this, arguments)
      }
      return (0, o.default)(BaseLoader, [{
        key: "getDefaultSettings",
        value: function getDefaultSettings() {
          return {
            isInserted: !1,
            selectors: {
              firstScript: "script:first"
            }
          }
        }
      }, {
        key: "getDefaultElements",
        value: function getDefaultElements() {
          return {
            $firstScript: jQuery(this.getSettings("selectors.firstScript"))
          }
        }
      }, {
        key: "insertAPI",
        value: function insertAPI() {
          this.elements.$firstScript.before(jQuery("<script>", {
            src: this.getApiURL()
          })), this.setSettings("isInserted", !0)
        }
      }, {
        key: "getVideoIDFromURL",
        value: function getVideoIDFromURL(e) {
          var t = e.match(this.getURLRegex());
          return t && t[1]
        }
      }, {
        key: "onApiReady",
        value: function onApiReady(e) {
          var t = this;
          this.getSettings("isInserted") || this.insertAPI(), this.isApiLoaded() ? e(this.getApiObject()) : setTimeout((function () {
            t.onApiReady(e)
          }), 350)
        }
      }]), BaseLoader
    }(elementorModules.ViewModule);
  t.default = l
}, function (e, t, n) {
  "use strict";
  var i = n(0);
  n(1)(t, "__esModule", {
    value: !0
  }), t.default = void 0;
  var r = i(n(2)),
    o = i(n(3)),
    s = i(n(25)),
    a = i(n(16)),
    l = i(n(4)),
    u = i(n(5)),
    c = function (e) {
      (0, l.default)(BackgroundSlideshow, e);
      var t = (0, u.default)(BackgroundSlideshow);

      function BackgroundSlideshow() {
        return (0, r.default)(this, BackgroundSlideshow), t.apply(this, arguments)
      }
      return (0, o.default)(BackgroundSlideshow, [{
        key: "getDefaultSettings",
        value: function getDefaultSettings() {
          return {
            classes: {
              swiperContainer: "elementor-background-slideshow swiper-container",
              swiperWrapper: "swiper-wrapper",
              swiperSlide: "elementor-background-slideshow__slide swiper-slide",
              slideBackground: "elementor-background-slideshow__slide__image",
              kenBurns: "elementor-ken-burns",
              kenBurnsActive: "elementor-ken-burns--active",
              kenBurnsIn: "elementor-ken-burns--in",
              kenBurnsOut: "elementor-ken-burns--out"
            }
          }
        }
      }, {
        key: "getSwiperOptions",
        value: function getSwiperOptions() {
          var e = this,
            t = this.getElementSettings(),
            n = {
              grabCursor: !1,
              slidesPerView: 1,
              slidesPerGroup: 1,
              loop: "yes" === t.background_slideshow_loop,
              speed: t.background_slideshow_transition_duration,
              autoplay: {
                delay: t.background_slideshow_slide_duration,
                stopOnLastSlide: !t.background_slideshow_loop
              },
              handleElementorBreakpoints: !0,
              on: {
                slideChange: function slideChange() {
                  t.background_slideshow_ken_burns && e.handleKenBurns()
                }
              }
            };
          switch ("yes" === t.background_slideshow_loop && (n.loopedSlides = this.getSlidesCount()), t.background_slideshow_slide_transition) {
            case "fade":
              n.effect = "fade", n.fadeEffect = {
                crossFade: !0
              };
              break;
            case "slide_down":
              n.autoplay.reverseDirection = !0;
            case "slide_up":
              n.direction = "vertical"
          }
          return n
        }
      }, {
        key: "buildSwiperElements",
        value: function buildSwiperElements() {
          var e = this,
            t = this.getSettings("classes"),
            n = this.getElementSettings(),
            i = "slide_left" === n.background_slideshow_slide_transition ? "ltr" : "rtl",
            r = jQuery("<div>", {
              class: t.swiperContainer,
              dir: i
            }),
            o = jQuery("<div>", {
              class: t.swiperWrapper
            }),
            s = n.background_slideshow_ken_burns,
            a = t.slideBackground;
          if (s) {
            a += " " + t.kenBurns;
            var l = "in" === n.background_slideshow_ken_burns_zoom_direction ? "kenBurnsIn" : "kenBurnsOut";
            a += " " + t[l]
          }
          this.elements.$slides = jQuery(), n.background_slideshow_gallery.forEach((function (n) {
            var i = jQuery("<div>", {
              class: t.swiperSlide
            }),
              r = jQuery("<div>", {
                class: a,
                style: 'background-image: url("' + n.url + '");'
              });
            i.append(r), o.append(i), e.elements.$slides = e.elements.$slides.add(i)
          })), r.append(o), this.$element.prepend(r), this.elements.$backgroundSlideShowContainer = r
        }
      }, {
        key: "initSlider",
        value: function initSlider() {
          if (!(1 >= this.getSlidesCount())) {
            var e = this.getElementSettings();
            this.swiper = new Swiper(this.elements.$backgroundSlideShowContainer, this.getSwiperOptions()), this.elements.$backgroundSlideShowContainer.data("swiper", this.swiper), e.background_slideshow_ken_burns && this.handleKenBurns()
          }
        }
      }, {
        key: "activate",
        value: function activate() {
          this.buildSwiperElements(), this.initSlider()
        }
      }, {
        key: "deactivate",
        value: function deactivate() {
          this.swiper && (this.swiper.destroy(), this.elements.$backgroundSlideShowContainer.remove())
        }
      }, {
        key: "run",
        value: function run() {
          "slideshow" === this.getElementSettings("background_background") ? this.activate() : this.deactivate()
        }
      }, {
        key: "onInit",
        value: function onInit() {
          (0, s.default)((0, a.default)(BackgroundSlideshow.prototype), "onInit", this).call(this), this.getElementSettings("background_slideshow_gallery") && this.run()
        }
      }, {
        key: "onDestroy",
        value: function onDestroy() {
          (0, s.default)((0, a.default)(BackgroundSlideshow.prototype), "onDestroy", this).call(this), this.deactivate()
        }
      }, {
        key: "onElementChange",
        value: function onElementChange(e) {
          "background_background" === e && this.run()
        }
      }]), BackgroundSlideshow
    }(elementorModules.frontend.handlers.SwiperBase);
  t.default = c
}, , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , function (e, t, n) {
  "use strict";
  var i = n(0);
  n(26), n(58);
  var r = i(n(2)),
    o = i(n(3)),
    s = i(n(4)),
    a = i(n(5)),
    l = i(n(786)),
    u = i(n(626)),
    c = i(n(272)),
    d = i(n(787)),
    f = i(n(788)),
    h = i(n(789)),
    p = i(n(790)),
    v = n(387),
    g = n(791),
    m = n(808),
    y = n(809),
    b = function (e) {
      (0, s.default)(Frontend, e);
      var t = (0, a.default)(Frontend);

      function Frontend() {
        var e;
        (0, r.default)(this, Frontend);
        for (var n = arguments.length, i = new Array(n), o = 0; o < n; o++) i[o] = arguments[o];
        return (e = t.call.apply(t, [this].concat(i))).config = elementorFrontendConfig, e
      }
      return (0, o.default)(Frontend, [{
        key: "getDefaultSettings",
        value: function getDefaultSettings() {
          return {
            selectors: {
              elementor: ".elementor",
              adminBar: "#wpadminbar"
            },
            classes: {
              ie: "elementor-msie"
            }
          }
        }
      }, {
        key: "getDefaultElements",
        value: function getDefaultElements() {
          var e = {
            window: window,
            $window: jQuery(window),
            $document: jQuery(document),
            $head: jQuery(document.head),
            $body: jQuery(document.body),
            $deviceMode: jQuery("<span>", {
              id: "elementor-device-mode",
              class: "elementor-screen-only"
            })
          };
          return e.$body.append(e.$deviceMode), e
        }
      }, {
        key: "bindEvents",
        value: function bindEvents() {
          var e = this;
          this.elements.$window.on("resize", (function () {
            return e.setDeviceModeData()
          }))
        }
      }, {
        key: "getElements",
        value: function getElements(e) {
          return this.getItems(this.elements, e)
        }
      }, {
        key: "getPageSettings",
        value: function getPageSettings(e) {
          var t = this.isEditMode() ? elementor.settings.page.model.attributes : this.config.settings.page;
          return this.getItems(t, e)
        }
      }, {
        key: "getGeneralSettings",
        value: function getGeneralSettings(e) {
          return elementorCommon.helpers.softDeprecated("getGeneralSettings", "3.0.0", "getKitSettings and remove the `elementor_` prefix"), this.getKitSettings("elementor_".concat(e))
        }
      }, {
        key: "getKitSettings",
        value: function getKitSettings(e) {
          return this.getItems(this.config.kit, e)
        }
      }, {
        key: "getCurrentDeviceMode",
        value: function getCurrentDeviceMode() {
          return getComputedStyle(this.elements.$deviceMode[0], ":after").content.replace(/"/g, "")
        }
      }, {
        key: "getDeviceSetting",
        value: function getDeviceSetting(e, t, n) {
          for (var i = ["desktop", "tablet", "mobile"], r = i.indexOf(e); r > 0;) {
            var o = t[n + "_" + i[r]];
            if (o) return o;
            r--
          }
          return t[n]
        }
      }, {
        key: "getCurrentDeviceSetting",
        value: function getCurrentDeviceSetting(e, t) {
          return this.getDeviceSetting(elementorFrontend.getCurrentDeviceMode(), e, t)
        }
      }, {
        key: "isEditMode",
        value: function isEditMode() {
          return this.config.environmentMode.edit
        }
      }, {
        key: "isWPPreviewMode",
        value: function isWPPreviewMode() {
          return this.config.environmentMode.wpPreview
        }
      }, {
        key: "initDialogsManager",
        value: function initDialogsManager() {
          var e;
          this.getDialogsManager = function () {
            return e || (e = new DialogsManager.Instance), e
          }
        }
      }, {
        key: "initOnReadyComponents",
        value: function initOnReadyComponents() {
          var e = this;
          this.utils = {
            youtube: new d.default,
            vimeo: new f.default,
            anchors: new m,
            lightbox: new y,
            urlActions: new h.default,
            swiper: p.default
          }, this.modules = {
            StretchElement: elementorModules.frontend.tools.StretchElement,
            Masonry: elementorModules.utils.Masonry
          }, this.elementsHandler = new g(jQuery), this.isEditMode() ? elementor.once("document:loaded", (function () {
            return e.onDocumentLoaded()
          })) : this.onDocumentLoaded()
        }
      }, {
        key: "initOnReadyElements",
        value: function initOnReadyElements() {
          this.elements.$wpAdminBar = this.elements.$document.find(this.getSettings("selectors.adminBar"))
        }
      }, {
        key: "addIeCompatibility",
        value: function addIeCompatibility() {
          var e = "string" == typeof document.createElement("div").style.grid;
          if (c.default.ie || !e) {
            this.elements.$body.addClass(this.getSettings("classes.ie"));
            var t = '<link rel="stylesheet" id="elementor-frontend-css-msie" href="' + this.config.urls.assets + "css/frontend-msie.min.css?" + this.config.version + '" type="text/css" />';
            this.elements.$body.append(t)
          }
        }
      }, {
        key: "setDeviceModeData",
        value: function setDeviceModeData() {
          this.elements.$body.attr("data-elementor-device-mode", this.getCurrentDeviceMode())
        }
      }, {
        key: "addListenerOnce",
        value: function addListenerOnce(e, t, n, i) {
          if (i || (i = this.elements.$window), this.isEditMode())
            if (this.removeListeners(e, t, i), i instanceof jQuery) {
              var r = t + "." + e;
              i.on(r, n)
            } else i.on(t, n, e);
          else i.on(t, n)
        }
      }, {
        key: "removeListeners",
        value: function removeListeners(e, t, n, i) {
          if (i || (i = this.elements.$window), i instanceof jQuery) {
            var r = t + "." + e;
            i.off(r, n)
          } else i.off(t, n, e)
        }
      }, {
        key: "debounce",
        value: function debounce(e, t) {
          var n;
          return function () {
            var i = this,
              r = arguments,
              o = function later() {
                n = null, e.apply(i, r)
              },
              s = !n;
            clearTimeout(n), n = setTimeout(o, t), s && e.apply(i, r)
          }
        }
      }, {
        key: "waypoint",
        value: function waypoint(e, t, n) {
          n = jQuery.extend({
            offset: "100%",
            triggerOnce: !0
          }, n);
          return e.elementorWaypoint((function correctCallback() {
            var e = this.element || this,
              i = t.apply(e, arguments);
            return n.triggerOnce && this.destroy && this.destroy(), i
          }), n)
        }
      }, {
        key: "muteMigrationTraces",
        value: function muteMigrationTraces() {
          jQuery.migrateMute = !0, jQuery.migrateTrace = !1
        }
      }, {
        key: "init",
        value: function init() {
          this.hooks = new v, this.storage = new u.default, this.addIeCompatibility(), this.setDeviceModeData(), this.initDialogsManager(), this.isEditMode() && this.muteMigrationTraces(), this.elements.$window.trigger("elementor/frontend/init"), this.initOnReadyElements(), this.initOnReadyComponents()
        }
      }, {
        key: "onDocumentLoaded",
        value: function onDocumentLoaded() {
          this.documentsManager = new l.default, this.trigger("components:init")
        }
      }, {
        key: "Module",
        get: function get() {
          return this.isEditMode() && parent.elementorCommon.helpers.hardDeprecated("elementorFrontend.Module", "2.5.0", "elementorModules.frontend.handlers.Base"), elementorModules.frontend.handlers.Base
        }
      }]), Frontend
    }(elementorModules.ViewModule);
  window.elementorFrontend = new b, elementorFrontend.isEditMode() || jQuery((function () {
    return elementorFrontend.init()
  }))
}, function (e, t, n) {
  "use strict";
  var i = n(0);
  n(1)(t, "__esModule", {
    value: !0
  }), t.default = void 0;
  var r = i(n(2)),
    o = i(n(3)),
    s = i(n(4)),
    a = i(n(5)),
    l = i(n(657)),
    u = function (e) {
      (0, s.default)(_default, e);
      var t = (0, a.default)(_default);

      function _default() {
        var e;
        (0, r.default)(this, _default);
        for (var n = arguments.length, i = new Array(n), o = 0; o < n; o++) i[o] = arguments[o];
        return (e = t.call.apply(t, [this].concat(i))).documents = {}, e.initDocumentClasses(), e.attachDocumentsClasses(), e
      }
      return (0, o.default)(_default, [{
        key: "getDefaultSettings",
        value: function getDefaultSettings() {
          return {
            selectors: {
              document: ".elementor"
            }
          }
        }
      }, {
        key: "getDefaultElements",
        value: function getDefaultElements() {
          var e = this.getSettings("selectors");
          return {
            $documents: jQuery(e.document)
          }
        }
      }, {
        key: "initDocumentClasses",
        value: function initDocumentClasses() {
          this.documentClasses = {
            base: l.default
          }, elementorFrontend.hooks.doAction("elementor/frontend/documents-manager/init-classes", this)
        }
      }, {
        key: "addDocumentClass",
        value: function addDocumentClass(e, t) {
          this.documentClasses[e] = t
        }
      }, {
        key: "attachDocumentsClasses",
        value: function attachDocumentsClasses() {
          var e = this;
          this.elements.$documents.each((function (t, n) {
            return e.attachDocumentClass(jQuery(n))
          }))
        }
      }, {
        key: "attachDocumentClass",
        value: function attachDocumentClass(e) {
          var t = e.data(),
            n = t.elementorId,
            i = t.elementorType,
            r = this.documentClasses[i] || this.documentClasses.base;
          this.documents[n] = new r({
            $element: e,
            id: n
          })
        }
      }]), _default
    }(elementorModules.ViewModule);
  t.default = u
}, function (e, t, n) {
  "use strict";
  var i = n(0);
  n(1)(t, "__esModule", {
    value: !0
  }), t.default = void 0;
  var r = i(n(2)),
    o = i(n(3)),
    s = i(n(4)),
    a = i(n(5)),
    l = function (e) {
      (0, s.default)(YoutubeLoader, e);
      var t = (0, a.default)(YoutubeLoader);

      function YoutubeLoader() {
        return (0, r.default)(this, YoutubeLoader), t.apply(this, arguments)
      }
      return (0, o.default)(YoutubeLoader, [{
        key: "getApiURL",
        value: function getApiURL() {
          return "https://www.youtube.com/iframe_api"
        }
      }, {
        key: "getURLRegex",
        value: function getURLRegex() {
          return /^(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtu\.be\/|youtube\.com\/(?:(?:watch)?\?(?:.*&)?vi?=|(?:embed|v|vi|user)\/))([^?&"'>]+)/
        }
      }, {
        key: "isApiLoaded",
        value: function isApiLoaded() {
          return window.YT && YT.loaded
        }
      }, {
        key: "getApiObject",
        value: function getApiObject() {
          return YT
        }
      }]), YoutubeLoader
    }(i(n(697)).default);
  t.default = l
}, function (e, t, n) {
  "use strict";
  var i = n(0);
  n(1)(t, "__esModule", {
    value: !0
  }), t.default = void 0;
  var r = i(n(2)),
    o = i(n(3)),
    s = i(n(4)),
    a = i(n(5)),
    l = function (e) {
      (0, s.default)(VimeoLoader, e);
      var t = (0, a.default)(VimeoLoader);

      function VimeoLoader() {
        return (0, r.default)(this, VimeoLoader), t.apply(this, arguments)
      }
      return (0, o.default)(VimeoLoader, [{
        key: "getApiURL",
        value: function getApiURL() {
          return "https://player.vimeo.com/api/player.js"
        }
      }, {
        key: "getURLRegex",
        value: function getURLRegex() {
          return /^(?:https?:\/\/)?(?:www|player\.)?(?:vimeo\.com\/)?(?:video\/|external\/)?(\d+)([^.?&#"'>]?)/
        }
      }, {
        key: "isApiLoaded",
        value: function isApiLoaded() {
          return window.Vimeo
        }
      }, {
        key: "getApiObject",
        value: function getApiObject() {
          return Vimeo
        }
      }]), VimeoLoader
    }(i(n(697)).default);
  t.default = l
}, function (e, t, n) {
  "use strict";
  var i = n(0);
  n(1)(t, "__esModule", {
    value: !0
  }), t.default = void 0;
  var r = i(n(204));
  n(119);
  var o = i(n(2)),
    s = i(n(3)),
    a = i(n(25)),
    l = i(n(16)),
    u = i(n(4)),
    c = i(n(5)),
    d = function (e) {
      (0, u.default)(_default, e);
      var t = (0, c.default)(_default);

      function _default() {
        return (0, o.default)(this, _default), t.apply(this, arguments)
      }
      return (0, s.default)(_default, [{
        key: "getDefaultSettings",
        value: function getDefaultSettings() {
          return {
            selectors: {
              links: 'a[href^="%23elementor-action"], a[href^="#elementor-action"]'
            }
          }
        }
      }, {
        key: "bindEvents",
        value: function bindEvents() {
          elementorFrontend.elements.$document.on("click", this.getSettings("selectors.links"), this.runLinkAction.bind(this))
        }
      }, {
        key: "initActions",
        value: function initActions() {
          this.actions = {
            lightbox: function lightbox(e) {
              e.id ? elementorFrontend.utils.lightbox.openSlideshow(e.id, e.url) : elementorFrontend.utils.lightbox.showModal(e)
            }
          }
        }
      }, {
        key: "addAction",
        value: function addAction(e, t) {
          this.actions[e] = t
        }
      }, {
        key: "runAction",
        value: function runAction(e) {
          var t = (e = decodeURIComponent(e)).match(/action=(.+?)&/),
            n = e.match(/settings=(.+)/);
          if (t) {
            var i = this.actions[t[1]];
            if (i) {
              var r = {};
              n && (r = JSON.parse(atob(n[1])));
              for (var o = arguments.length, s = new Array(o > 1 ? o - 1 : 0), a = 1; a < o; a++) s[a - 1] = arguments[a];
              i.apply(void 0, [r].concat(s))
            }
          }
        }
      }, {
        key: "runLinkAction",
        value: function runLinkAction(e) {
          e.preventDefault(), this.runAction(jQuery(e.currentTarget).attr("href"), e)
        }
      }, {
        key: "runHashAction",
        value: function runHashAction() {
          location.hash && this.runAction(location.hash)
        }
      }, {
        key: "createActionHash",
        value: function createActionHash(e, t) {
          return encodeURIComponent("#elementor-action:action=".concat(e, "&settings=").concat(btoa((0, r.default)(t))))
        }
      }, {
        key: "onInit",
        value: function onInit() {
          (0, a.default)((0, l.default)(_default.prototype), "onInit", this).call(this), this.initActions(), elementorFrontend.on("components:init", this.runHashAction.bind(this))
        }
      }]), _default
    }(elementorModules.ViewModule);
  t.default = d
}, function (e, t, n) {
  "use strict";
  var i = n(0);
  n(1)(t, "__esModule", {
    value: !0
  }), t.default = void 0, n(302);
  var r = i(n(211)),
    o = i(n(23)),
    s = i(n(54)),
    a = i(n(2)),
    l = i(n(3)),
    u = window.Swiper,
    c = function () {
      function Swiper(e, t) {
        return (0, a.default)(this, Swiper), this.config = t, this.config.breakpoints && (this.config = this.adjustConfig(t)), u.prototype.adjustConfig = this.adjustConfig, new u(e, this.config)
      }
      return (0, l.default)(Swiper, [{
        key: "adjustConfig",
        value: function adjustConfig(e) {
          if (!e.handleElementorBreakpoints) return e;
          var t = elementorFrontend.config.breakpoints,
            n = (0, s.default)(t);
          return (0, o.default)(e.breakpoints).forEach((function (i) {
            var o, s = (0, r.default)(i);
            if (s === t.md || s + 1 === t.md) o = t.xs;
            else {
              var a = n.findIndex((function (e) {
                return s === e || s + 1 === e
              }));
              o = n[a - 1]
            }
            e.breakpoints[o] = e.breakpoints[i], e.breakpoints[i] = {
              slidesPerView: e.slidesPerView,
              slidesPerGroup: e.slidesPerGroup ? e.slidesPerGroup : 1
            }
          })), e
        }
      }]), Swiper
    }();
  t.default = c, window.Swiper = c
}, function (e, t, n) {
  "use strict";
  var i = n(0),
    r = i(n(792)),
    o = i(n(793)),
    s = i(n(794)),
    a = i(n(795)),
    l = i(n(796)),
    u = i(n(797)),
    c = i(n(798)),
    d = i(n(799)),
    f = i(n(800)),
    h = i(n(801)),
    p = i(n(806)),
    v = i(n(807));
  e.exports = function (e) {
    var t = this,
      n = {
        section: h.default,
        column: p.default,
        "accordion.default": r.default,
        "alert.default": o.default,
        "counter.default": s.default,
        "progress.default": a.default,
        "tabs.default": l.default,
        "toggle.default": u.default,
        "video.default": c.default,
        "image-carousel.default": d.default,
        "text-editor.default": f.default
      },
      i = {};
    this.initHandlers = function () {
      ! function addGlobalHandlers() {
        elementorFrontend.hooks.addAction("frontend/element_ready/global", v.default)
      }(),
        function addElementsHandlers() {
          e.each(n, (function (e, t) {
            elementorFrontend.hooks.addAction("frontend/element_ready/" + e, t)
          }))
        }()
    }, this.addHandler = function (e, t) {
      var n, r = t.$element.data("model-cid");
      if (r) {
        n = e.prototype.getConstructorID(), i[r] || (i[r] = {});
        var o = i[r][n];
        o && o.onDestroy()
      }
      var s = new e(t);
      r && (i[r][n] = s)
    }, this.getHandlers = function (e) {
      return e ? n[e] : n
    }, this.runReadyTrigger = function (t) {
      if (!elementorFrontend.config.is_static) {
        var n = jQuery(t),
          i = n.attr("data-element_type");
        i && (elementorFrontend.hooks.doAction("frontend/element_ready/global", n, e), elementorFrontend.hooks.doAction("frontend/element_ready/" + i, n, e), "widget" === i && elementorFrontend.hooks.doAction("frontend/element_ready/" + n.attr("data-widget_type"), n, e))
      }
    },
      function init() {
        t.initHandlers()
      }()
  }
}, function (e, t, n) {
  "use strict";
  var i = n(0);
  n(1)(t, "__esModule", {
    value: !0
  }), t.default = void 0;
  var r = i(n(658));
  t.default = function _default(e) {
    elementorFrontend.elementsHandler.addHandler(r.default, {
      $element: e,
      showTabFn: "slideDown",
      hideTabFn: "slideUp"
    })
  }
}, function (e, t, n) {
  "use strict";
  var i = n(0);
  n(1)(t, "__esModule", {
    value: !0
  }), t.default = void 0, n(26);
  var r = i(n(2)),
    o = i(n(3)),
    s = i(n(4)),
    a = i(n(5)),
    l = function (e) {
      (0, s.default)(Alert, e);
      var t = (0, a.default)(Alert);

      function Alert() {
        return (0, r.default)(this, Alert), t.apply(this, arguments)
      }
      return (0, o.default)(Alert, [{
        key: "getDefaultSettings",
        value: function getDefaultSettings() {
          return {
            selectors: {
              dismissButton: ".elementor-alert-dismiss"
            }
          }
        }
      }, {
        key: "getDefaultElements",
        value: function getDefaultElements() {
          var e = this.getSettings("selectors");
          return {
            $dismissButton: this.$element.find(e.dismissButton)
          }
        }
      }, {
        key: "bindEvents",
        value: function bindEvents() {
          this.elements.$dismissButton.on("click", this.onDismissButtonClick.bind(this))
        }
      }, {
        key: "onDismissButtonClick",
        value: function onDismissButtonClick() {
          this.$element.fadeOut()
        }
      }]), Alert
    }(elementorModules.frontend.handlers.Base);
  t.default = function _default(e) {
    elementorFrontend.elementsHandler.addHandler(l, {
      $element: e
    })
  }
}, function (e, t, n) {
  "use strict";
  var i = n(0);
  n(1)(t, "__esModule", {
    value: !0
  }), t.default = void 0, n(182), n(72), n(119), n(26);
  var r = i(n(2)),
    o = i(n(3)),
    s = i(n(25)),
    a = i(n(16)),
    l = i(n(4)),
    u = i(n(5)),
    c = function (e) {
      (0, l.default)(Counter, e);
      var t = (0, u.default)(Counter);

      function Counter() {
        return (0, r.default)(this, Counter), t.apply(this, arguments)
      }
      return (0, o.default)(Counter, [{
        key: "getDefaultSettings",
        value: function getDefaultSettings() {
          return {
            selectors: {
              counterNumber: ".elementor-counter-number"
            }
          }
        }
      }, {
        key: "getDefaultElements",
        value: function getDefaultElements() {
          var e = this.getSettings("selectors");
          return {
            $counterNumber: this.$element.find(e.counterNumber)
          }
        }
      }, {
        key: "onInit",
        value: function onInit() {
          var e = this;
          (0, s.default)((0, a.default)(Counter.prototype), "onInit", this).call(this), elementorFrontend.waypoint(this.elements.$counterNumber, (function () {
            var t = e.elements.$counterNumber.data(),
              n = t.toValue.toString().match(/\.(.*)/);
            n && (t.rounding = n[1].length), e.elements.$counterNumber.numerator(t)
          }))
        }
      }]), Counter
    }(elementorModules.frontend.handlers.Base);
  t.default = function _default(e) {
    elementorFrontend.elementsHandler.addHandler(c, {
      $element: e
    })
  }
}, function (e, t, n) {
  "use strict";
  var i = n(0);
  n(1)(t, "__esModule", {
    value: !0
  }), t.default = void 0, n(26);
  var r = i(n(2)),
    o = i(n(3)),
    s = i(n(25)),
    a = i(n(16)),
    l = i(n(4)),
    u = i(n(5)),
    c = function (e) {
      (0, l.default)(Progress, e);
      var t = (0, u.default)(Progress);

      function Progress() {
        return (0, r.default)(this, Progress), t.apply(this, arguments)
      }
      return (0, o.default)(Progress, [{
        key: "getDefaultSettings",
        value: function getDefaultSettings() {
          return {
            selectors: {
              progressNumber: ".elementor-progress-bar"
            }
          }
        }
      }, {
        key: "getDefaultElements",
        value: function getDefaultElements() {
          var e = this.getSettings("selectors");
          return {
            $progressNumber: this.$element.find(e.progressNumber)
          }
        }
      }, {
        key: "onInit",
        value: function onInit() {
          var e = this;
          (0, s.default)((0, a.default)(Progress.prototype), "onInit", this).call(this), elementorFrontend.waypoint(this.elements.$progressNumber, (function () {
            var t = e.elements.$progressNumber;
            t.css("width", t.data("max") + "%")
          }))
        }
      }]), Progress
    }(elementorModules.frontend.handlers.Base);
  t.default = function _default(e) {
    elementorFrontend.elementsHandler.addHandler(c, {
      $element: e
    })
  }
}, function (e, t, n) {
  "use strict";
  var i = n(0);
  n(1)(t, "__esModule", {
    value: !0
  }), t.default = void 0;
  var r = i(n(658));
  t.default = function _default(e) {
    elementorFrontend.elementsHandler.addHandler(r.default, {
      $element: e,
      toggleSelf: !1
    })
  }
}, function (e, t, n) {
  "use strict";
  var i = n(0);
  n(1)(t, "__esModule", {
    value: !0
  }), t.default = void 0;
  var r = i(n(658));
  t.default = function _default(e) {
    elementorFrontend.elementsHandler.addHandler(r.default, {
      $element: e,
      showTabFn: "slideDown",
      hideTabFn: "slideUp",
      hidePrevious: !1,
      autoExpand: "editor"
    })
  }
}, function (e, t, n) {
  "use strict";
  var i = n(0);
  n(1)(t, "__esModule", {
    value: !0
  }), t.default = void 0, n(141), n(188), n(58), n(26);
  var r = i(n(2)),
    o = i(n(3)),
    s = i(n(4)),
    a = i(n(5)),
    l = function (e) {
      (0, s.default)(VideoModule, e);
      var t = (0, a.default)(VideoModule);

      function VideoModule() {
        return (0, r.default)(this, VideoModule), t.apply(this, arguments)
      }
      return (0, o.default)(VideoModule, [{
        key: "getDefaultSettings",
        value: function getDefaultSettings() {
          return {
            selectors: {
              imageOverlay: ".elementor-custom-embed-image-overlay",
              video: ".elementor-video",
              videoIframe: ".elementor-video-iframe"
            }
          }
        }
      }, {
        key: "getDefaultElements",
        value: function getDefaultElements() {
          var e = this.getSettings("selectors");
          return {
            $imageOverlay: this.$element.find(e.imageOverlay),
            $video: this.$element.find(e.video),
            $videoIframe: this.$element.find(e.videoIframe)
          }
        }
      }, {
        key: "getLightBox",
        value: function getLightBox() {
          return elementorFrontend.utils.lightbox
        }
      }, {
        key: "handleVideo",
        value: function handleVideo() {
          this.getElementSettings("lightbox") || (this.elements.$imageOverlay.remove(), this.playVideo())
        }
      }, {
        key: "playVideo",
        value: function playVideo() {
          if (this.elements.$video.length) this.elements.$video[0].play();
          else {
            var e = this.elements.$videoIframe,
              t = e.data("lazy-load");
            t && e.attr("src", t);
            var n = e[0].src.replace("&autoplay=0", "");
            if (e[0].src = n + "&autoplay=1", e[0].src.includes("vimeo.com")) {
              var i = e[0].src,
                r = /#t=[^&]*/.exec(i);
              e[0].src = i.slice(0, r.index) + i.slice(r.index + r[0].length) + r[0]
            }
          }
        }
      }, {
        key: "animateVideo",
        value: function animateVideo() {
          this.getLightBox().setEntranceAnimation(this.getCurrentDeviceSetting("lightbox_content_animation"))
        }
      }, {
        key: "handleAspectRatio",
        value: function handleAspectRatio() {
          this.getLightBox().setVideoAspectRatio(this.getElementSettings("aspect_ratio"))
        }
      }, {
        key: "bindEvents",
        value: function bindEvents() {
          this.elements.$imageOverlay.on("click", this.handleVideo.bind(this))
        }
      }, {
        key: "onElementChange",
        value: function onElementChange(e) {
          if (0 !== e.indexOf("lightbox_content_animation")) {
            var t = this.getElementSettings("lightbox");
            "lightbox" !== e || t ? "aspect_ratio" === e && t && this.handleAspectRatio() : this.getLightBox().getModal().hide()
          } else this.animateVideo()
        }
      }]), VideoModule
    }(elementorModules.frontend.handlers.Base);
  t.default = function _default(e) {
    elementorFrontend.elementsHandler.addHandler(l, {
      $element: e
    })
  }
}, function (e, t, n) {
  "use strict";
  var i = n(0);
  n(1)(t, "__esModule", {
    value: !0
  }), t.default = void 0, n(26);
  var r = i(n(2)),
    o = i(n(3)),
    s = i(n(25)),
    a = i(n(16)),
    l = i(n(4)),
    u = i(n(5)),
    c = function (e) {
      (0, l.default)(ImageCarouselHandler, e);
      var t = (0, u.default)(ImageCarouselHandler);

      function ImageCarouselHandler() {
        return (0, r.default)(this, ImageCarouselHandler), t.apply(this, arguments)
      }
      return (0, o.default)(ImageCarouselHandler, [{
        key: "getDefaultSettings",
        value: function getDefaultSettings() {
          return {
            selectors: {
              carousel: ".elementor-image-carousel-wrapper",
              slideContent: ".swiper-slide"
            }
          }
        }
      }, {
        key: "getDefaultElements",
        value: function getDefaultElements() {
          var e = this.getSettings("selectors"),
            t = {
              $swiperContainer: this.$element.find(e.carousel)
            };
          return t.$slides = t.$swiperContainer.find(e.slideContent), t
        }
      }, {
        key: "getSwiperSettings",
        value: function getSwiperSettings() {
          var e = this.getElementSettings(),
            t = +e.slides_to_show || 3,
            n = 1 === t,
            i = n ? 1 : 2,
            r = elementorFrontend.config.breakpoints,
            o = {
              slidesPerView: t,
              loop: "yes" === e.infinite,
              speed: e.speed,
              handleElementorBreakpoints: !0,
              breakpoints: {}
            };
          o.breakpoints[r.md] = {
            slidesPerView: +e.slides_to_show_mobile || 1,
            slidesPerGroup: +e.slides_to_scroll_mobile || 1
          }, o.breakpoints[r.lg] = {
            slidesPerView: +e.slides_to_show_tablet || i,
            slidesPerGroup: +e.slides_to_scroll_tablet || 1
          }, this.isEdit || "yes" !== e.autoplay || (o.autoplay = {
            delay: e.autoplay_speed,
            disableOnInteraction: "yes" === e.pause_on_interaction
          }), n ? (o.effect = e.effect, "fade" === e.effect && (o.fadeEffect = {
            crossFade: !0
          })) : o.slidesPerGroup = +e.slides_to_scroll || 1, e.image_spacing_custom && (o.spaceBetween = e.image_spacing_custom.size);
          var s = "arrows" === e.navigation || "both" === e.navigation,
            a = "dots" === e.navigation || "both" === e.navigation;
          return s && (o.navigation = {
            prevEl: ".elementor-swiper-button-prev",
            nextEl: ".elementor-swiper-button-next"
          }), a && (o.pagination = {
            el: ".swiper-pagination",
            type: "bullets",
            clickable: !0
          }), o
        }
      }, {
        key: "onInit",
        value: function onInit() {
          for (var e, t = arguments.length, n = new Array(t), i = 0; i < t; i++) n[i] = arguments[i];
          (e = (0, s.default)((0, a.default)(ImageCarouselHandler.prototype), "onInit", this)).call.apply(e, [this].concat(n));
          var r = this.getElementSettings();
          !this.elements.$swiperContainer.length || 2 > this.elements.$slides.length || (this.swiper = new Swiper(this.elements.$swiperContainer, this.getSwiperSettings()), this.elements.$swiperContainer.data("swiper", this.swiper), "yes" === r.pause_on_hover && this.togglePauseOnHover(!0))
        }
      }, {
        key: "updateSwiperOption",
        value: function updateSwiperOption(e) {
          var t = this.getElementSettings(),
            n = t[e],
            i = this.getChangeableProperties()[e],
            r = n;
          switch (e) {
            case "image_spacing_custom":
              r = n.size || 0;
              break;
            case "autoplay":
              r = !!n && {
                delay: t.autoplay_speed,
                disableOnInteraction: "yes" === t.pause_on_interaction
              };
              break;
            case "autoplay_speed":
              i = "autoplay", r = {
                delay: n,
                disableOnInteraction: "yes" === t.pause_on_interaction
              };
              break;
            case "pause_on_hover":
              this.togglePauseOnHover("yes" === n);
              break;
            case "pause_on_interaction":
              r = "yes" === n
          }
          "pause_on_hover" !== e && (this.swiper.params[i] = r), this.swiper.update()
        }
      }, {
        key: "getChangeableProperties",
        value: function getChangeableProperties() {
          return {
            autoplay: "autoplay",
            pause_on_hover: "pauseOnHover",
            pause_on_interaction: "disableOnInteraction",
            autoplay_speed: "delay",
            speed: "speed",
            image_spacing_custom: "spaceBetween"
          }
        }
      }, {
        key: "onElementChange",
        value: function onElementChange(e) {
          this.getChangeableProperties().propertyName && this.updateSwiperOption(e)
        }
      }, {
        key: "onEditSettingsChange",
        value: function onEditSettingsChange(e) {
          "activeItemIndex" === e && this.swiper.slideToLoop(this.getEditSettings("activeItemIndex") - 1)
        }
      }]), ImageCarouselHandler
    }(elementorModules.frontend.handlers.SwiperBase);
  t.default = function _default(e) {
    elementorFrontend.elementsHandler.addHandler(c, {
      $element: e
    })
  }
}, function (e, t, n) {
  "use strict";
  var i = n(0);
  n(1)(t, "__esModule", {
    value: !0
  }), t.default = void 0, n(119), n(58), n(26);
  var r = i(n(2)),
    o = i(n(3)),
    s = i(n(25)),
    a = i(n(16)),
    l = i(n(4)),
    u = i(n(5)),
    c = function (e) {
      (0, l.default)(TextEditor, e);
      var t = (0, u.default)(TextEditor);

      function TextEditor() {
        return (0, r.default)(this, TextEditor), t.apply(this, arguments)
      }
      return (0, o.default)(TextEditor, [{
        key: "getDefaultSettings",
        value: function getDefaultSettings() {
          return {
            selectors: {
              paragraph: "p:first"
            },
            classes: {
              dropCap: "elementor-drop-cap",
              dropCapLetter: "elementor-drop-cap-letter"
            }
          }
        }
      }, {
        key: "getDefaultElements",
        value: function getDefaultElements() {
          var e = this.getSettings("selectors"),
            t = this.getSettings("classes"),
            n = jQuery("<span>", {
              class: t.dropCap
            }),
            i = jQuery("<span>", {
              class: t.dropCapLetter
            });
          return n.append(i), {
            $paragraph: this.$element.find(e.paragraph),
            $dropCap: n,
            $dropCapLetter: i
          }
        }
      }, {
        key: "wrapDropCap",
        value: function wrapDropCap() {
          if (this.getElementSettings("drop_cap")) {
            var e = this.elements.$paragraph;
            if (e.length) {
              var t = e.html().replace(/ /g, " "),
                n = t.match(/^ *([^ ] ?)/);
              if (n) {
                var i = n[1],
                  r = i.trim();
                if ("<" !== r) {
                  this.dropCapLetter = i, this.elements.$dropCapLetter.text(r);
                  var o = t.slice(i.length).replace(/^ */, (function (e) {
                    return new Array(e.length + 1).join(" ")
                  }));
                  e.html(o).prepend(this.elements.$dropCap)
                }
              }
            }
          } else this.dropCapLetter && (this.elements.$dropCap.remove(), this.elements.$paragraph.prepend(this.dropCapLetter), this.dropCapLetter = "")
        }
      }, {
        key: "onInit",
        value: function onInit() {
          for (var e, t = arguments.length, n = new Array(t), i = 0; i < t; i++) n[i] = arguments[i];
          (e = (0, s.default)((0, a.default)(TextEditor.prototype), "onInit", this)).call.apply(e, [this].concat(n)), this.wrapDropCap()
        }
      }, {
        key: "onElementChange",
        value: function onElementChange(e) {
          "drop_cap" === e && this.wrapDropCap()
        }
      }]), TextEditor
    }(elementorModules.frontend.handlers.Base);
  t.default = function _default(e) {
    elementorFrontend.elementsHandler.addHandler(c, {
      $element: e
    })
  }
}, function (e, t, n) {
  "use strict";
  var i = n(0);
  n(1)(t, "__esModule", {
    value: !0
  }), t.default = void 0;
  var r = i(n(698)),
    o = i(n(802)),
    s = i(n(803)),
    a = i(n(804)),
    l = i(n(805));
  t.default = function _default(e) {
    (elementorFrontend.isEditMode() || e.hasClass("elementor-section-stretched")) && elementorFrontend.elementsHandler.addHandler(a.default, {
      $element: e
    }), elementorFrontend.isEditMode() && (elementorFrontend.elementsHandler.addHandler(l.default, {
      $element: e
    }), elementorFrontend.elementsHandler.addHandler(s.default, {
      $element: e
    })), elementorFrontend.elementsHandler.addHandler(o.default, {
      $element: e
    }), elementorFrontend.elementsHandler.addHandler(r.default, {
      $element: e
    })
  }
}, function (e, t, n) {
  "use strict";
  var i = n(0);
  n(1)(t, "__esModule", {
    value: !0
  }), t.default = void 0, n(119), n(80), n(26);
  var r = i(n(2)),
    o = i(n(3)),
    s = i(n(25)),
    a = i(n(16)),
    l = i(n(4)),
    u = i(n(5)),
    c = function (e) {
      (0, l.default)(BackgroundVideo, e);
      var t = (0, u.default)(BackgroundVideo);

      function BackgroundVideo() {
        return (0, r.default)(this, BackgroundVideo), t.apply(this, arguments)
      }
      return (0, o.default)(BackgroundVideo, [{
        key: "getDefaultSettings",
        value: function getDefaultSettings() {
          return {
            selectors: {
              backgroundVideoContainer: ".elementor-background-video-container",
              backgroundVideoEmbed: ".elementor-background-video-embed",
              backgroundVideoHosted: ".elementor-background-video-hosted"
            }
          }
        }
      }, {
        key: "getDefaultElements",
        value: function getDefaultElements() {
          var e = this.getSettings("selectors"),
            t = {
              $backgroundVideoContainer: this.$element.find(e.backgroundVideoContainer)
            };
          return t.$backgroundVideoEmbed = t.$backgroundVideoContainer.children(e.backgroundVideoEmbed), t.$backgroundVideoHosted = t.$backgroundVideoContainer.children(e.backgroundVideoHosted), t
        }
      }, {
        key: "calcVideosSize",
        value: function calcVideosSize(e) {
          var t = "16:9";
          "vimeo" === this.videoType && (t = e[0].width + ":" + e[0].height);
          var n = this.elements.$backgroundVideoContainer.outerWidth(),
            i = this.elements.$backgroundVideoContainer.outerHeight(),
            r = t.split(":"),
            o = r[0] / r[1],
            s = n / i > o;
          return {
            width: s ? n : i * o,
            height: s ? n / o : i
          }
        }
      }, {
        key: "changeVideoSize",
        value: function changeVideoSize() {
          var e;
          if (("hosted" === this.videoType || this.player) && ("youtube" === this.videoType ? e = jQuery(this.player.getIframe()) : "vimeo" === this.videoType ? e = jQuery(this.player.element) : "hosted" === this.videoType && (e = this.elements.$backgroundVideoHosted), e)) {
            var t = this.calcVideosSize(e);
            e.width(t.width).height(t.height)
          }
        }
      }, {
        key: "startVideoLoop",
        value: function startVideoLoop(e) {
          var t = this;
          if (this.player.getIframe().contentWindow) {
            var n = this.getElementSettings(),
              i = n.background_video_start || 0,
              r = n.background_video_end;
            if (!n.background_play_once || e) {
              if (this.player.seekTo(i), r) setTimeout((function () {
                t.startVideoLoop(!1)
              }), 1e3 * (r - i + 1))
            } else this.player.stopVideo()
          }
        }
      }, {
        key: "prepareVimeoVideo",
        value: function prepareVimeoVideo(e, t) {
          var n = this,
            i = this.getElementSettings(),
            r = (i.background_video_start && i.background_video_start, {
              id: t,
              width: this.elements.$backgroundVideoContainer.outerWidth().width,
              autoplay: !0,
              loop: !i.background_play_once,
              transparent: !1,
              background: !0,
              muted: !0
            });
          this.player = new e.Player(this.elements.$backgroundVideoContainer, r), this.handleVimeoStartEndTimes(i), this.player.ready().then((function () {
            jQuery(n.player.element).addClass("elementor-background-video-embed"), n.changeVideoSize()
          }))
        }
      }, {
        key: "handleVimeoStartEndTimes",
        value: function handleVimeoStartEndTimes(e) {
          var t = this;
          e.background_video_start && this.player.on("play", (function (n) {
            0 === n.seconds && t.player.setCurrentTime(e.background_video_start)
          })), this.player.on("timeupdate", (function (n) {
            e.background_video_end && e.background_video_end < n.seconds && (e.background_play_once ? t.player.pause() : t.player.setCurrentTime(e.background_video_start)), t.player.getDuration().then((function (i) {
              e.background_video_start && !e.background_video_end && n.seconds > i - .5 && t.player.setCurrentTime(e.background_video_start)
            }))
          }))
        }
      }, {
        key: "prepareYTVideo",
        value: function prepareYTVideo(e, t) {
          var n = this,
            i = this.elements.$backgroundVideoContainer,
            r = this.getElementSettings(),
            o = e.PlayerState.PLAYING;
          window.chrome && (o = e.PlayerState.UNSTARTED), i.addClass("elementor-loading elementor-invisible"), this.player = new e.Player(this.elements.$backgroundVideoEmbed[0], {
            videoId: t,
            events: {
              onReady: function onReady() {
                n.player.mute(), n.changeVideoSize(), n.startVideoLoop(!0), n.player.playVideo()
              },
              onStateChange: function onStateChange(t) {
                switch (t.data) {
                  case o:
                    i.removeClass("elementor-invisible elementor-loading");
                    break;
                  case e.PlayerState.ENDED:
                    n.player.seekTo(r.background_video_start || 0), r.background_play_once && n.player.destroy()
                }
              }
            },
            playerVars: {
              controls: 0,
              rel: 0,
              playsinline: 1
            }
          })
        }
      }, {
        key: "activate",
        value: function activate() {
          var e, t = this,
            n = this.getElementSettings("background_video_link"),
            i = this.getElementSettings("background_play_once");
          if (-1 !== n.indexOf("vimeo.com") ? (this.videoType = "vimeo", this.apiProvider = elementorFrontend.utils.vimeo) : n.match(/^(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtu\.be\/|youtube\.com)/) && (this.videoType = "youtube", this.apiProvider = elementorFrontend.utils.youtube), this.apiProvider) e = this.apiProvider.getVideoIDFromURL(n), this.apiProvider.onApiReady((function (n) {
            "youtube" === t.videoType && t.prepareYTVideo(n, e), "vimeo" === t.videoType && t.prepareVimeoVideo(n, e)
          }));
          else {
            this.videoType = "hosted";
            var r = this.getElementSettings("background_video_start"),
              o = this.getElementSettings("background_video_end");
            (r || o) && (n += "#t=" + (r || 0) + (o ? "," + o : "")), this.elements.$backgroundVideoHosted.attr("src", n).one("canplay", this.changeVideoSize.bind(this)), i && this.elements.$backgroundVideoHosted.on("ended", (function () {
              t.elements.$backgroundVideoHosted.hide()
            }))
          }
          elementorFrontend.elements.$window.on("resize", this.changeVideoSize)
        }
      }, {
        key: "deactivate",
        value: function deactivate() {
          "youtube" === this.videoType && this.player.getIframe() || "vimeo" === this.videoType ? this.player.destroy() : this.elements.$backgroundVideoHosted.removeAttr("src").off("ended"), elementorFrontend.elements.$window.off("resize", this.changeVideoSize)
        }
      }, {
        key: "run",
        value: function run() {
          var e = this.getElementSettings();
          (e.background_play_on_mobile || "mobile" !== elementorFrontend.getCurrentDeviceMode()) && ("video" === e.background_background && e.background_video_link ? this.activate() : this.deactivate())
        }
      }, {
        key: "onInit",
        value: function onInit() {
          for (var e, t = arguments.length, n = new Array(t), i = 0; i < t; i++) n[i] = arguments[i];
          (e = (0, s.default)((0, a.default)(BackgroundVideo.prototype), "onInit", this)).call.apply(e, [this].concat(n)), this.changeVideoSize = this.changeVideoSize.bind(this), this.run()
        }
      }, {
        key: "onElementChange",
        value: function onElementChange(e) {
          "background_background" === e && this.run()
        }
      }]), BackgroundVideo
    }(elementorModules.frontend.handlers.Base);
  t.default = c
}, function (e, t, n) {
  "use strict";
  var i = n(0);
  n(1)(t, "__esModule", {
    value: !0
  }), t.default = void 0, n(26);
  var r = i(n(2)),
    o = i(n(3)),
    s = i(n(4)),
    a = i(n(5)),
    l = function (e) {
      (0, s.default)(HandlesPosition, e);
      var t = (0, a.default)(HandlesPosition);

      function HandlesPosition() {
        return (0, r.default)(this, HandlesPosition), t.apply(this, arguments)
      }
      return (0, o.default)(HandlesPosition, [{
        key: "isFirstSection",
        value: function isFirstSection() {
          return this.$element.is(".elementor-edit-mode .elementor-top-section:first")
        }
      }, {
        key: "isOverflowHidden",
        value: function isOverflowHidden() {
          return "hidden" === this.$element.css("overflow")
        }
      }, {
        key: "getOffset",
        value: function getOffset() {
          if ("body" === elementor.config.document.container) return this.$element.offset().top;
          var e = jQuery(elementor.config.document.container);
          return this.$element.offset().top - e.offset().top
        }
      }, {
        key: "setHandlesPosition",
        value: function setHandlesPosition() {
          var e = elementor.documents.getCurrent();
          if (e && e.container.isEditable()) {
            var t = this.isOverflowHidden();
            if (t || this.isFirstSection()) {
              var n = t ? 0 : this.getOffset(),
                i = this.$element.find("> .elementor-element-overlay > .elementor-editor-section-settings");
              n < 25 ? (this.$element.addClass("elementor-section--handles-inside"), n < -5 ? i.css("top", -n) : i.css("top", "")) : this.$element.removeClass("elementor-section--handles-inside")
            }
          }
        }
      }, {
        key: "onInit",
        value: function onInit() {
          this.setHandlesPosition(), this.$element.on("mouseenter", this.setHandlesPosition.bind(this))
        }
      }]), HandlesPosition
    }(elementorModules.frontend.handlers.Base);
  t.default = l
}, function (e, t, n) {
  "use strict";
  var i = n(0);
  n(1)(t, "__esModule", {
    value: !0
  }), t.default = void 0;
  var r = i(n(2)),
    o = i(n(3)),
    s = i(n(25)),
    a = i(n(16)),
    l = i(n(4)),
    u = i(n(5)),
    c = function (e) {
      (0, l.default)(StretchedSection, e);
      var t = (0, u.default)(StretchedSection);

      function StretchedSection() {
        return (0, r.default)(this, StretchedSection), t.apply(this, arguments)
      }
      return (0, o.default)(StretchedSection, [{
        key: "bindEvents",
        value: function bindEvents() {
          var e = this.getUniqueHandlerID();
          elementorFrontend.addListenerOnce(e, "resize", this.stretch), elementorFrontend.addListenerOnce(e, "sticky:stick", this.stretch, this.$element), elementorFrontend.addListenerOnce(e, "sticky:unstick", this.stretch, this.$element), elementorFrontend.isEditMode() && (this.onKitChangeStretchContainerChange = this.onKitChangeStretchContainerChange.bind(this), elementor.channels.editor.on("kit:change:stretchContainer", this.onKitChangeStretchContainerChange))
        }
      }, {
        key: "unbindEvents",
        value: function unbindEvents() {
          elementorFrontend.removeListeners(this.getUniqueHandlerID(), "resize", this.stretch), elementorFrontend.isEditMode() && elementor.channels.editor.off("kit:change:stretchContainer", this.onKitChangeStretchContainerChange)
        }
      }, {
        key: "initStretch",
        value: function initStretch() {
          this.stretch = this.stretch.bind(this), this.stretchElement = new elementorModules.frontend.tools.StretchElement({
            element: this.$element,
            selectors: {
              container: this.getStretchContainer()
            }
          })
        }
      }, {
        key: "getStretchContainer",
        value: function getStretchContainer() {
          return elementorFrontend.getKitSettings("stretched_section_container") || window
        }
      }, {
        key: "stretch",
        value: function stretch() {
          this.getElementSettings("stretch_section") && this.stretchElement.stretch()
        }
      }, {
        key: "onInit",
        value: function onInit() {
          var e;
          this.initStretch();
          for (var t = arguments.length, n = new Array(t), i = 0; i < t; i++) n[i] = arguments[i];
          (e = (0, s.default)((0, a.default)(StretchedSection.prototype), "onInit", this)).call.apply(e, [this].concat(n)), this.stretch()
        }
      }, {
        key: "onElementChange",
        value: function onElementChange(e) {
          "stretch_section" === e && (this.getElementSettings("stretch_section") ? this.stretch() : this.stretchElement.reset())
        }
      }, {
        key: "onKitChangeStretchContainerChange",
        value: function onKitChangeStretchContainerChange() {
          this.stretchElement.setSettings("selectors.container", this.getStretchContainer()), this.stretch()
        }
      }]), StretchedSection
    }(elementorModules.frontend.handlers.Base);
  t.default = c
}, function (e, t, n) {
  "use strict";
  var i = n(0);
  n(1)(t, "__esModule", {
    value: !0
  }), t.default = void 0, n(119), n(58), n(26);
  var r = i(n(2)),
    o = i(n(3)),
    s = i(n(25)),
    a = i(n(16)),
    l = i(n(4)),
    u = i(n(5)),
    c = function (e) {
      (0, l.default)(Shapes, e);
      var t = (0, u.default)(Shapes);

      function Shapes() {
        return (0, r.default)(this, Shapes), t.apply(this, arguments)
      }
      return (0, o.default)(Shapes, [{
        key: "getDefaultSettings",
        value: function getDefaultSettings() {
          return {
            selectors: {
              container: "> .elementor-shape-%s"
            },
            svgURL: elementorFrontend.config.urls.assets + "shapes/"
          }
        }
      }, {
        key: "getDefaultElements",
        value: function getDefaultElements() {
          var e = {},
            t = this.getSettings("selectors");
          return e.$topContainer = this.$element.find(t.container.replace("%s", "top")), e.$bottomContainer = this.$element.find(t.container.replace("%s", "bottom")), e
        }
      }, {
        key: "getSvgURL",
        value: function getSvgURL(e, t) {
          var n = this.getSettings("svgURL") + t + ".svg";
          return elementor.config.additional_shapes && e in elementor.config.additional_shapes && (n = elementor.config.additional_shapes[e], -1 < t.indexOf("-negative") && (n = n.replace(".svg", "-negative.svg"))), n
        }
      }, {
        key: "buildSVG",
        value: function buildSVG(e) {
          var t = "shape_divider_" + e,
            n = this.getElementSettings(t),
            i = this.elements["$" + e + "Container"];
          if (i.attr("data-shape", n), n) {
            var r = n;
            this.getElementSettings(t + "_negative") && (r += "-negative");
            var o = this.getSvgURL(n, r);
            jQuery.get(o, (function (e) {
              i.empty().append(e.childNodes[0])
            })), this.setNegative(e)
          } else i.empty()
        }
      }, {
        key: "setNegative",
        value: function setNegative(e) {
          this.elements["$" + e + "Container"].attr("data-negative", !!this.getElementSettings("shape_divider_" + e + "_negative"))
        }
      }, {
        key: "onInit",
        value: function onInit() {
          for (var e, t = this, n = arguments.length, i = new Array(n), r = 0; r < n; r++) i[r] = arguments[r];
          (e = (0, s.default)((0, a.default)(Shapes.prototype), "onInit", this)).call.apply(e, [this].concat(i)), ["top", "bottom"].forEach((function (e) {
            t.getElementSettings("shape_divider_" + e) && t.buildSVG(e)
          }))
        }
      }, {
        key: "onElementChange",
        value: function onElementChange(e) {
          var t = e.match(/^shape_divider_(top|bottom)$/);
          if (t) this.buildSVG(t[1]);
          else {
            var n = e.match(/^shape_divider_(top|bottom)_negative$/);
            n && (this.buildSVG(n[1]), this.setNegative(n[1]))
          }
        }
      }]), Shapes
    }(elementorModules.frontend.handlers.Base);
  t.default = c
}, function (e, t, n) {
  "use strict";
  var i = n(0);
  n(1)(t, "__esModule", {
    value: !0
  }), t.default = void 0;
  var r = i(n(698));
  t.default = function _default(e) {
    elementorFrontend.elementsHandler.addHandler(r.default, {
      $element: e
    })
  }
}, function (e, t, n) {
  "use strict";
  var i = n(0);
  n(1)(t, "__esModule", {
    value: !0
  }), t.default = void 0;
  var r = i(n(2)),
    o = i(n(3)),
    s = i(n(25)),
    a = i(n(16)),
    l = i(n(4)),
    u = i(n(5)),
    c = function (e) {
      (0, l.default)(GlobalHandler, e);
      var t = (0, u.default)(GlobalHandler);

      function GlobalHandler() {
        return (0, r.default)(this, GlobalHandler), t.apply(this, arguments)
      }
      return (0, o.default)(GlobalHandler, [{
        key: "getWidgetType",
        value: function getWidgetType() {
          return "global"
        }
      }, {
        key: "animate",
        value: function animate() {
          var e = this.$element,
            t = this.getAnimation();
          if ("none" !== t) {
            var n = this.getElementSettings(),
              i = n._animation_delay || n.animation_delay || 0;
            e.removeClass(t), this.currentAnimation && e.removeClass(this.currentAnimation), this.currentAnimation = t, setTimeout((function () {
              e.removeClass("elementor-invisible").addClass("animated " + t)
            }), i)
          } else e.removeClass("elementor-invisible")
        }
      }, {
        key: "getAnimation",
        value: function getAnimation() {
          return this.getCurrentDeviceSetting("animation") || this.getCurrentDeviceSetting("_animation")
        }
      }, {
        key: "onInit",
        value: function onInit() {
          for (var e, t = this, n = arguments.length, i = new Array(n), r = 0; r < n; r++) i[r] = arguments[r];
          (e = (0, s.default)((0, a.default)(GlobalHandler.prototype), "onInit", this)).call.apply(e, [this].concat(i)), this.getAnimation() && elementorFrontend.waypoint(this.$element, (function () {
            return t.animate()
          }))
        }
      }, {
        key: "onElementChange",
        value: function onElementChange(e) {
          /^_?animation/.test(e) && this.animate()
        }
      }]), GlobalHandler
    }(elementorModules.frontend.handlers.Base);
  t.default = function _default(e) {
    elementorFrontend.elementsHandler.addHandler(c, {
      $element: e
    })
  }
}, function (e, t, n) {
  "use strict";
  e.exports = elementorModules.ViewModule.extend({
    getDefaultSettings: function getDefaultSettings() {
      return {
        scrollDuration: 500,
        selectors: {
          links: 'a[href*="#"]',
          targets: ".elementor-element, .elementor-menu-anchor",
          scrollable: "html, body"
        }
      }
    },
    getDefaultElements: function getDefaultElements() {
      return {
        $scrollable: jQuery(this.getSettings("selectors").scrollable)
      }
    },
    bindEvents: function bindEvents() {
      elementorFrontend.elements.$document.on("click", this.getSettings("selectors.links"), this.handleAnchorLinks)
    },
    handleAnchorLinks: function handleAnchorLinks(e) {
      var t, n = e.currentTarget,
        i = location.pathname === n.pathname;
      if (location.hostname === n.hostname && i && !(n.hash.length < 2)) {
        try {
          t = jQuery(n.hash).filter(this.getSettings("selectors.targets"))
        } catch (e) {
          return
        }
        if (t.length) {
          var r = t.offset().top,
            o = elementorFrontend.elements.$wpAdminBar,
            s = jQuery(".elementor-section.elementor-sticky--active:visible");
          o.length > 0 && (r -= o.height()), s.length > 0 && (r -= Math.max.apply(null, s.map((function () {
            return jQuery(this).outerHeight()
          })).get())), e.preventDefault(), r = elementorFrontend.hooks.applyFilters("frontend/handlers/menu_anchor/scroll_top_distance", r), this.elements.$scrollable.animate({
            scrollTop: r
          }, this.getSettings("scrollDuration"), "linear")
        }
      }
    },
    onInit: function onInit() {
      elementorModules.ViewModule.prototype.onInit.apply(this, arguments), this.bindEvents()
    }
  })
}, function (e, t, n) {
  "use strict";
  var i = n(0);
  n(119), n(26), n(58);
  var r = i(n(810));
  e.exports = elementorModules.ViewModule.extend({
    oldAspectRatio: null,
    oldAnimation: null,
    swiper: null,
    player: null,
    getDefaultSettings: function getDefaultSettings() {
      return {
        classes: {
          aspectRatio: "elementor-aspect-ratio-%s",
          item: "elementor-lightbox-item",
          image: "elementor-lightbox-image",
          videoContainer: "elementor-video-container",
          videoWrapper: "elementor-fit-aspect-ratio",
          playButton: "elementor-custom-embed-play",
          playButtonIcon: "fa",
          playing: "elementor-playing",
          hidden: "elementor-hidden",
          invisible: "elementor-invisible",
          preventClose: "elementor-lightbox-prevent-close",
          slideshow: {
            container: "swiper-container",
            slidesWrapper: "swiper-wrapper",
            prevButton: "elementor-swiper-button elementor-swiper-button-prev",
            nextButton: "elementor-swiper-button elementor-swiper-button-next",
            prevButtonIcon: "eicon-chevron-left",
            nextButtonIcon: "eicon-chevron-right",
            slide: "swiper-slide",
            header: "elementor-slideshow__header",
            footer: "elementor-slideshow__footer",
            title: "elementor-slideshow__title",
            description: "elementor-slideshow__description",
            counter: "elementor-slideshow__counter",
            iconExpand: "eicon-frame-expand",
            iconShrink: "eicon-frame-minimize",
            iconZoomIn: "eicon-zoom-in-bold",
            iconZoomOut: "eicon-zoom-out-bold",
            iconShare: "eicon-share-arrow",
            shareMenu: "elementor-slideshow__share-menu",
            shareLinks: "elementor-slideshow__share-links",
            hideUiVisibility: "elementor-slideshow--ui-hidden",
            shareMode: "elementor-slideshow--share-mode",
            fullscreenMode: "elementor-slideshow--fullscreen-mode",
            zoomMode: "elementor-slideshow--zoom-mode"
          }
        },
        selectors: {
          image: ".elementor-lightbox-image",
          links: "a, [data-elementor-lightbox]",
          slideshow: {
            activeSlide: ".swiper-slide-active",
            prevSlide: ".swiper-slide-prev",
            nextSlide: ".swiper-slide-next"
          }
        },
        modalOptions: {
          id: "elementor-lightbox",
          entranceAnimation: "zoomIn",
          videoAspectRatio: 169,
          position: {
            enable: !1
          }
        }
      }
    },
    getModal: function getModal() {
      return e.exports.modal || this.initModal(), e.exports.modal
    },
    initModal: function initModal() {
      var t = e.exports.modal = elementorFrontend.getDialogsManager().createWidget("lightbox", {
        className: "elementor-lightbox",
        closeButton: !0,
        closeButtonOptions: {
          iconClass: "eicon-close",
          attributes: {
            tabindex: 0,
            role: "button",
            "aria-label": elementorFrontend.config.i18n.close + " (Esc)"
          }
        },
        selectors: {
          preventClose: "." + this.getSettings("classes.preventClose")
        },
        hide: {
          onClick: !0
        }
      });
      t.on("hide", (function () {
        t.setMessage("")
      }))
    },
    showModal: function showModal(e) {
      this.elements.$closeButton = this.getModal().getElements("closeButton"), this.$buttons = this.elements.$closeButton, this.focusedButton = null;
      var t = this,
        n = t.getDefaultSettings().modalOptions;
      t.id = e.id, t.setSettings("modalOptions", jQuery.extend(n, e.modalOptions));
      var i = t.getModal();
      switch (i.setID(t.getSettings("modalOptions.id")), i.onShow = function () {
        DialogsManager.getWidgetType("lightbox").prototype.onShow.apply(i, arguments), t.setEntranceAnimation()
      }, i.onHide = function () {
        DialogsManager.getWidgetType("lightbox").prototype.onHide.apply(i, arguments), i.getElements("message").removeClass("animated"), r.default.isFullscreen && t.deactivateFullscreen(), t.unbindHotKeys()
      }, e.type) {
        case "video":
          t.setVideoContent(e);
          break;
        case "image":
          var o = [{
            image: e.url,
            index: 0,
            title: e.title,
            description: e.description
          }];
          e.slideshow = {
            slides: o,
            swiper: {
              loop: !1,
              pagination: !1
            }
          };
        case "slideshow":
          t.setSlideshowContent(e.slideshow);
          break;
        default:
          t.setHTMLContent(e.html)
      }
      i.show()
    },
    setHTMLContent: function setHTMLContent(e) {
      this.getModal().setMessage(e)
    },
    setVideoContent: function setVideoContent(e) {
      var t, n = jQuery,
        i = this.getSettings("classes"),
        r = n("<div>", {
          class: "".concat(i.videoContainer, " ").concat(i.preventClose)
        }),
        o = n("<div>", {
          class: i.videoWrapper
        }),
        s = this.getModal();
      if ("hosted" === e.videoType) {
        var a = n.extend({
          src: e.url,
          autoplay: ""
        }, e.videoParams);
        t = n("<video>", a)
      } else {
        t = n("<iframe>", {
          src: e.url.replace("&autoplay=0", "") + "&autoplay=1",
          allowfullscreen: 1
        })
      }
      r.append(o), o.append(t), s.setMessage(r), this.setVideoAspectRatio();
      var l = s.onHide;
      s.onHide = function () {
        l(), this.$buttons = jQuery(), this.focusedButton = null, s.getElements("message").removeClass("elementor-fit-aspect-ratio")
      }
    },
    getShareLinks: function getShareLinks() {
      var e, t = this,
        n = elementorFrontend.config.i18n,
        i = {
          facebook: n.shareOnFacebook,
          twitter: n.shareOnTwitter,
          pinterest: n.pinIt
        },
        r = jQuery,
        o = this.getSettings("classes"),
        s = this.getSettings("selectors"),
        a = r("<div>", {
          class: o.slideshow.shareLinks
        }),
        l = this.getSlide("active"),
        u = l.find(s.image),
        c = l.data("elementor-slideshow-video");
      return e = c || u.attr("src"), r.each(i, (function (n, i) {
        var o = r("<a>", {
          href: t.createShareLink(n, e),
          target: "_blank"
        }).text(i);
        o.prepend(r("<i>", {
          class: "eicon-" + n
        })), a.append(o)
      })), c || a.append(r("<a>", {
        href: e,
        download: ""
      }).text(n.downloadImage).prepend(r("<i>", {
        class: "eicon-download-bold",
        "aria-label": n.download
      }))), a
    },
    createShareLink: function createShareLink(e, t) {
      var n = {};
      if ("pinterest" === e) n.image = encodeURIComponent(t);
      else {
        var i = elementorFrontend.utils.urlActions.createActionHash("lightbox", {
          id: this.id,
          url: t
        });
        n.url = encodeURIComponent(location.href.replace(/#.*/, "")) + i
      }
      return ShareLink.getNetworkLink(e, n)
    },
    getSlideshowHeader: function getSlideshowHeader() {
      var e = elementorFrontend.config.i18n,
        t = jQuery,
        n = "yes" === elementorFrontend.getKitSettings("lightbox_enable_counter"),
        i = "yes" === elementorFrontend.getKitSettings("lightbox_enable_fullscreen"),
        r = "yes" === elementorFrontend.getKitSettings("lightbox_enable_zoom"),
        o = "yes" === elementorFrontend.getKitSettings("lightbox_enable_share"),
        s = this.getSettings("classes"),
        a = s.slideshow,
        l = this.elements;
      if (n || i || r || o) {
        if (l.$header = t("<header>", {
          class: a.header + " " + s.preventClose
        }), o) {
          l.$iconShare = t("<i>", {
            class: a.iconShare,
            role: "button",
            "aria-label": e.share,
            "aria-expanded": !1
          }).append(t("<span>"));
          var u = t("<div>");
          u.on("click", (function (e) {
            e.stopPropagation()
          })), l.$shareMenu = t("<div>", {
            class: a.shareMenu
          }).append(u), l.$iconShare.add(l.$shareMenu).on("click", this.toggleShareMenu), l.$header.append(l.$iconShare, l.$shareMenu), this.$buttons = this.$buttons.add(l.$iconShare)
        }
        return r && (l.$iconZoom = t("<i>", {
          class: a.iconZoomIn,
          role: "switch",
          "aria-checked": !1,
          "aria-label": e.zoom
        }), l.$iconZoom.on("click", this.toggleZoomMode), l.$header.append(l.$iconZoom), this.$buttons = this.$buttons.add(l.$iconZoom)), i && (l.$iconExpand = t("<i>", {
          class: a.iconExpand,
          role: "switch",
          "aria-checked": !1,
          "aria-label": e.fullscreen
        }).append(t("<span>"), t("<span>")), l.$iconExpand.on("click", this.toggleFullscreen), l.$header.append(l.$iconExpand), this.$buttons = this.$buttons.add(l.$iconExpand)), n && (l.$counter = t("<span>", {
          class: a.counter
        }), l.$header.append(l.$counter)), l.$header
      }
    },
    toggleFullscreen: function toggleFullscreen() {
      r.default.isFullscreen ? this.deactivateFullscreen() : r.default.isEnabled && this.activateFullscreen()
    },
    toggleZoomMode: function toggleZoomMode() {
      1 !== this.swiper.zoom.scale ? this.deactivateZoom() : this.activateZoom()
    },
    toggleShareMenu: function toggleShareMenu() {
      this.shareMode ? this.deactivateShareMode() : (this.elements.$shareMenu.html(this.getShareLinks()), this.activateShareMode())
    },
    activateShareMode: function activateShareMode() {
      var e = this.getSettings("classes");
      this.elements.$container.addClass(e.slideshow.shareMode), this.elements.$iconShare.attr("aria-expanded", !0), this.swiper.detachEvents(), this.$originalButtons = this.$buttons, this.$buttons = this.elements.$iconShare.add(this.elements.$shareMenu.find("a")), this.shareMode = !0
    },
    deactivateShareMode: function deactivateShareMode() {
      var e = this.getSettings("classes");
      this.elements.$container.removeClass(e.slideshow.shareMode), this.elements.$iconShare.attr("aria-expanded", !1), this.swiper.attachEvents(), this.$buttons = this.$originalButtons, this.shareMode = !1
    },
    activateFullscreen: function activateFullscreen() {
      var e = this.getSettings("classes");
      r.default.request(this.elements.$container.parents(".dialog-widget")[0]), this.elements.$iconExpand.removeClass(e.slideshow.iconExpand).addClass(e.slideshow.iconShrink).attr("aria-checked", "true"), this.elements.$container.addClass(e.slideshow.fullscreenMode)
    },
    deactivateFullscreen: function deactivateFullscreen() {
      var e = this.getSettings("classes");
      r.default.exit(), this.elements.$iconExpand.removeClass(e.slideshow.iconShrink).addClass(e.slideshow.iconExpand).attr("aria-checked", "false"), this.elements.$container.removeClass(e.slideshow.fullscreenMode)
    },
    activateZoom: function activateZoom() {
      var e = this.swiper,
        t = this.elements,
        n = this.getSettings("classes");
      e.zoom.in(), e.allowSlideNext = !1, e.allowSlidePrev = !1, e.allowTouchMove = !1, t.$container.addClass(n.slideshow.zoomMode), t.$iconZoom.removeClass(n.slideshow.iconZoomIn).addClass(n.slideshow.iconZoomOut)
    },
    deactivateZoom: function deactivateZoom() {
      var e = this.swiper,
        t = this.elements,
        n = this.getSettings("classes");
      e.zoom.out(), e.allowSlideNext = !0, e.allowSlidePrev = !0, e.allowTouchMove = !0, t.$container.removeClass(n.slideshow.zoomMode), t.$iconZoom.removeClass(n.slideshow.iconZoomOut).addClass(n.slideshow.iconZoomIn)
    },
    getSlideshowFooter: function getSlideshowFooter() {
      var e = jQuery,
        t = this.getSettings("classes"),
        n = e("<footer>", {
          class: t.slideshow.footer + " " + t.preventClose
        }),
        i = e("<div>", {
          class: t.slideshow.title
        }),
        r = e("<div>", {
          class: t.slideshow.description
        });
      return n.append(i, r), n
    },
    setSlideshowContent: function setSlideshowContent(e) {
      var t, n, i = this,
        r = elementorFrontend.config.i18n,
        o = jQuery,
        s = 1 === e.slides.length,
        a = "" !== elementorFrontend.getKitSettings("lightbox_title_src"),
        l = "" !== elementorFrontend.getKitSettings("lightbox_description_src"),
        u = a || l,
        c = this.getSettings("classes"),
        d = c.slideshow,
        f = o("<div>", {
          class: d.container
        }),
        h = o("<div>", {
          class: d.slidesWrapper
        });
      e.slides.forEach((function (e) {
        var t = d.slide + " " + c.item;
        e.video && (t += " " + c.video);
        var n = o("<div>", {
          class: t
        });
        if (e.video) {
          n.attr("data-elementor-slideshow-video", e.video);
          var i = o("<div>", {
            class: c.playButton
          }).html(o("<i>", {
            class: c.playButtonIcon,
            "aria-label": r.playVideo
          }));
          n.append(i)
        } else {
          var s = o("<div>", {
            class: "swiper-zoom-container"
          }),
            a = o('<div class="swiper-lazy-preloader"></div>'),
            l = {
              "data-src": e.image,
              class: c.image + " " + c.preventClose + " swiper-lazy"
            };
          e.title && (l["data-title"] = e.title, l.alt = e.title), e.description && (l["data-description"] = e.description, l.alt += " - " + e.description);
          var u = o("<img>", l);
          s.append([u, a]), n.append(s)
        }
        h.append(n)
      })), this.elements.$container = f, this.elements.$header = this.getSlideshowHeader(), f.prepend(this.elements.$header).append(h), s || (t = o("<div>", {
        class: d.prevButton + " " + c.preventClose,
        "aria-label": r.previous
      }).html(o("<i>", {
        class: d.prevButtonIcon
      })), n = o("<div>", {
        class: d.nextButton + " " + c.preventClose,
        "aria-label": r.next
      }).html(o("<i>", {
        class: d.nextButtonIcon
      })), f.append(n, t), this.$buttons = this.$buttons.add(n).add(t)), u && (this.elements.$footer = this.getSlideshowFooter(), f.append(this.elements.$footer)), this.setSettings("hideUiTimeout", ""), f.on("click mousemove keypress", this.showLightboxUi);
      var p = this.getModal();
      p.setMessage(f);
      var v = p.onShow;
      p.onShow = function () {
        v();
        var r = {
          pagination: {
            el: "." + d.counter,
            type: "fraction"
          },
          on: {
            slideChangeTransitionEnd: i.onSlideChange
          },
          lazy: {
            loadPrevNext: !0
          },
          zoom: !0,
          spaceBetween: 100,
          grabCursor: !0,
          runCallbacksOnInit: !1,
          loop: !0,
          keyboard: !0,
          handleElementorBreakpoints: !0
        };
        s || (r.navigation = {
          prevEl: t,
          nextEl: n
        }), e.swiper && o.extend(r, e.swiper), i.swiper = new Swiper(f, r), f.data("swiper", i.swiper), i.setVideoAspectRatio(), i.playSlideVideo(), u && i.updateFooterText(), i.bindHotKeys(), i.makeButtonsAccessible()
      }
    },
    makeButtonsAccessible: function makeButtonsAccessible() {
      this.$buttons.attr("tabindex", 0).on("keypress", (function (e) {
        13 !== e.which && 32 !== e.which || jQuery(e.currentTarget).trigger("click")
      }))
    },
    showLightboxUi: function showLightboxUi() {
      var e = this,
        t = this.getSettings("classes").slideshow;
      this.elements.$container.removeClass(t.hideUiVisibility), clearTimeout(this.getSettings("hideUiTimeout")), this.setSettings("hideUiTimeout", setTimeout((function () {
        e.shareMode || e.elements.$container.addClass(t.hideUiVisibility)
      }), 3500))
    },
    bindHotKeys: function bindHotKeys() {
      this.getModal().getElements("window").on("keydown", this.activeKeyDown)
    },
    unbindHotKeys: function unbindHotKeys() {
      this.getModal().getElements("window").off("keydown", this.activeKeyDown)
    },
    activeKeyDown: function activeKeyDown(e) {
      this.showLightboxUi();
      if (9 === e.which) {
        var t, n = this.$buttons,
          i = !1,
          r = !1;
        n.each((function (e) {
          var o = n[e];
          if (jQuery(o).is(":focus")) return t = o, i = 0 === e, r = n.length - 1 === e, !1
        })), e.shiftKey ? i && (e.preventDefault(), n.last().focus()) : !r && t || (e.preventDefault(), n.first().focus())
      }
    },
    setVideoAspectRatio: function setVideoAspectRatio(e) {
      e = e || this.getSettings("modalOptions.videoAspectRatio");
      var t = this.getModal().getElements("widgetContent"),
        n = this.oldAspectRatio,
        i = this.getSettings("classes.aspectRatio");
      this.oldAspectRatio = e, n && t.removeClass(i.replace("%s", n)), e && t.addClass(i.replace("%s", e))
    },
    getSlide: function getSlide(e) {
      return jQuery(this.swiper.slides).filter(this.getSettings("selectors.slideshow." + e + "Slide"))
    },
    updateFooterText: function updateFooterText() {
      if (this.elements.$footer) {
        var e = this.getSettings("classes"),
          t = this.getSlide("active").find(".elementor-lightbox-image"),
          n = t.data("title"),
          i = t.data("description"),
          r = this.elements.$footer.find("." + e.slideshow.title),
          o = this.elements.$footer.find("." + e.slideshow.description);
        r.text(n || ""), o.text(i || "")
      }
    },
    playSlideVideo: function playSlideVideo() {
      var e = this,
        t = this.getSlide("active"),
        n = t.data("elementor-slideshow-video");
      if (n) {
        var i, r, o = this.getSettings("classes"),
          s = jQuery("<div>", {
            class: o.videoContainer + " " + o.invisible
          }),
          a = jQuery("<div>", {
            class: o.videoWrapper
          }),
          l = t.children("." + o.playButton);
        s.append(a), t.append(s), -1 !== n.indexOf("vimeo.com") ? (i = "vimeo", r = elementorFrontend.utils.vimeo) : n.match(/^(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtu\.be\/|youtube\.com)/) && (i = "youtube", r = elementorFrontend.utils.youtube);
        var u = r.getVideoIDFromURL(n);
        r.onApiReady((function (t) {
          "youtube" === i ? e.prepareYTVideo(t, u, s, a, l) : "vimeo" === i && e.prepareVimeoVideo(t, u, s, a, l)
        })), l.addClass(o.playing).removeClass(o.hidden)
      }
    },
    prepareYTVideo: function prepareYTVideo(e, t, n, i, r) {
      var o = this,
        s = this.getSettings("classes"),
        a = jQuery("<div>"),
        l = e.PlayerState.PLAYING;
      i.append(a), window.chrome && (l = e.PlayerState.UNSTARTED), n.addClass("elementor-loading " + s.invisible), this.player = new e.Player(a[0], {
        videoId: t,
        events: {
          onReady: function onReady() {
            r.addClass(s.hidden), n.removeClass(s.invisible), o.player.playVideo()
          },
          onStateChange: function onStateChange(e) {
            e.data === l && n.removeClass("elementor-loading " + s.invisible)
          }
        },
        playerVars: {
          controls: 0,
          rel: 0
        }
      })
    },
    prepareVimeoVideo: function prepareVimeoVideo(e, t, n, i, r) {
      var o = this.getSettings("classes"),
        s = {
          id: t,
          autoplay: !0,
          transparent: !1,
          playsinline: !1
        };
      this.player = new e.Player(i, s), this.player.ready().then((function () {
        r.addClass(o.hidden), n.removeClass(o.invisible)
      }))
    },
    setEntranceAnimation: function setEntranceAnimation(e) {
      e = e || elementorFrontend.getCurrentDeviceSetting(this.getSettings("modalOptions"), "entranceAnimation");
      var t = this.getModal().getElements("message");
      this.oldAnimation && t.removeClass(this.oldAnimation), this.oldAnimation = e, e && t.addClass("animated " + e)
    },
    isLightboxLink: function isLightboxLink(e) {
      if ("A" === e.tagName && (e.hasAttribute("download") || !/^[^?]+\.(png|jpe?g|gif|svg|webp)(\?.*)?$/i.test(e.href))) return !1;
      var t = elementorFrontend.getKitSettings("global_image_lightbox"),
        n = e.dataset.elementorOpenLightbox;
      return "yes" === n || t && "no" !== n
    },
    openSlideshow: function openSlideshow(e, t) {
      var n = jQuery(this.getSettings("selectors.links")).filter((function (t, n) {
        var i = jQuery(n);
        return e === n.dataset.elementorLightboxSlideshow && !i.parent(".swiper-slide-duplicate").length && !i.parents(".slick-cloned").length
      })),
        i = [],
        r = 0;
      n.each((function () {
        var e = this.dataset.elementorLightboxVideo,
          o = this.dataset.elementorLightboxIndex;
        void 0 === o && (o = n.index(this)), (t === this.href || e && t === e) && (r = o);
        var s = {
          image: this.href,
          index: o,
          title: this.dataset.elementorLightboxTitle,
          description: this.dataset.elementorLightboxDescription
        };
        e && (s.video = e), i.push(s)
      })), i.sort((function (e, t) {
        return e.index - t.index
      })), this.showModal({
        type: "slideshow",
        id: e,
        modalOptions: {
          id: "elementor-lightbox-slideshow-" + e
        },
        slideshow: {
          slides: i,
          swiper: {
            initialSlide: +r
          }
        }
      })
    },
    openLink: function openLink(e) {
      var t = e.currentTarget,
        n = jQuery(e.target),
        i = elementorFrontend.isEditMode(),
        r = !!n.closest(".elementor-edit-area").length;
      if (this.isLightboxLink(t)) {
        if (e.preventDefault(), !i || elementor.getPreferences("lightbox_in_editor")) {
          var o = {};
          if (t.dataset.elementorLightbox && (o = JSON.parse(t.dataset.elementorLightbox)), o.type && "slideshow" !== o.type) this.showModal(o);
          else if (t.dataset.elementorLightboxSlideshow) {
            var s = t.dataset.elementorLightboxVideo ? t.dataset.elementorLightboxVideo : t.href;
            this.openSlideshow(t.dataset.elementorLightboxSlideshow, s)
          } else {
            this.showModal({
              type: "image",
              id: "single-img",
              url: t.href,
              title: t.dataset.elementorLightboxTitle,
              description: t.dataset.elementorLightboxDescription,
              modalOptions: {
                id: "elementor-lightbox-slideshow-single-img"
              }
            })
          }
        }
      } else i && r && e.preventDefault()
    },
    bindEvents: function bindEvents() {
      elementorFrontend.elements.$document.on("click", this.getSettings("selectors.links"), this.openLink)
    },
    onSlideChange: function onSlideChange() {
      this.getSlide("prev").add(this.getSlide("next")).add(this.getSlide("active")).find("." + this.getSettings("classes.videoWrapper")).remove(), this.playSlideVideo(), this.updateFooterText()
    }
  })
}, function (e, t, n) {
  "use strict";
  var i = n(0),
    r = i(n(289)),
    o = i(n(133));
  ! function () {
    var t = "undefined" != typeof window && void 0 !== window.document ? window.document : {},
      n = e.exports,
      i = function () {
        for (var e, n = [
          ["requestFullscreen", "exitFullscreen", "fullscreenElement", "fullscreenEnabled", "fullscreenchange", "fullscreenerror"],
          ["webkitRequestFullscreen", "webkitExitFullscreen", "webkitFullscreenElement", "webkitFullscreenEnabled", "webkitfullscreenchange", "webkitfullscreenerror"],
          ["webkitRequestFullScreen", "webkitCancelFullScreen", "webkitCurrentFullScreenElement", "webkitCancelFullScreen", "webkitfullscreenchange", "webkitfullscreenerror"],
          ["mozRequestFullScreen", "mozCancelFullScreen", "mozFullScreenElement", "mozFullScreenEnabled", "mozfullscreenchange", "mozfullscreenerror"],
          ["msRequestFullscreen", "msExitFullscreen", "msFullscreenElement", "msFullscreenEnabled", "MSFullscreenChange", "MSFullscreenError"]
        ], i = 0, r = n.length, o = {}; i < r; i++)
          if ((e = n[i]) && e[1] in t) {
            var s = e.length;
            for (i = 0; i < s; i++) o[n[0][i]] = e[i];
            return o
          }
        return !1
      }(),
      s = {
        change: i.fullscreenchange,
        error: i.fullscreenerror
      },
      a = {
        request: function request(e) {
          return new o.default(function (n, r) {
            var s = function () {
              this.off("change", s), n()
            }.bind(this);
            this.on("change", s), e = e || t.documentElement, o.default.resolve(e[i.requestFullscreen]()).catch(r)
          }.bind(this))
        },
        exit: function exit() {
          return new o.default(function (e, n) {
            if (this.isFullscreen) {
              var r = function () {
                this.off("change", r), e()
              }.bind(this);
              this.on("change", r), o.default.resolve(t[i.exitFullscreen]()).catch(n)
            } else e()
          }.bind(this))
        },
        toggle: function toggle(e) {
          return this.isFullscreen ? this.exit() : this.request(e)
        },
        onchange: function onchange(e) {
          this.on("change", e)
        },
        onerror: function onerror(e) {
          this.on("error", e)
        },
        on: function on(e, n) {
          var i = s[e];
          i && t.addEventListener(i, n, !1)
        },
        off: function off(e, n) {
          var i = s[e];
          i && t.removeEventListener(i, n, !1)
        },
        raw: i
      };
    i ? ((0, r.default)(a, {
      isFullscreen: {
        get: function get() {
          return Boolean(t[i.fullscreenElement])
        }
      },
      element: {
        enumerable: !0,
        get: function get() {
          return t[i.fullscreenElement]
        }
      },
      isEnabled: {
        enumerable: !0,
        get: function get() {
          return Boolean(t[i.fullscreenEnabled])
        }
      }
    }), n ? e.exports = a : window.screenfull = a) : n ? e.exports = {
      isEnabled: !1
    } : window.screenfull = {
      isEnabled: !1
    }
  }()
}])