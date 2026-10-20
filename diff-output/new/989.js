__d(function (g, _r, _i, a, m, _e, d) {
  var e = _r(d[0]);
  Object.defineProperty(_e, "__esModule", {
    value: !0
  }), _e.default = void 0;
  var n = e(_r(d[1])),
    t = e(_r(d[2])),
    r = C(_r(d[3])),
    o = _r(d[4]),
    i = _r(d[5]),
    s = _r(d[6]),
    c = _r(d[7]),
    u = e(_r(d[8])),
    l = C(_r(d[9])),
    f = e(_r(d[10])),
    p = e(_r(d[11])),
    S = e(_r(d[12])),
    h = e(_r(d[13])),
    j = _r(d[14]),
    y = e(_r(d[15])),
    O = _r(d[16]),
    b = _r(d[17]),
    v = _r(d[18]),
    x = _r(d[19]),
    T = _r(d[20]),
    w = _r(d[21]),
    P = _r(d[22]),
    k = e(_r(d[23])),
    _ = _r(d[24]);
  function C(e, n) {
    if ("function" == typeof WeakMap) var t = new WeakMap(),
      r = new WeakMap();
    return (C = function (e, n) {
      if (!n && e && e.__esModule) return e;
      var o,
        i,
        s = {
          __proto__: null,
          default: e
        };
      if (null === e || "object" != typeof e && "function" != typeof e) return s;
      if (o = n ? r : t) {
        if (o.has(e)) return o.get(e);
        o.set(e, s);
      }
      for (var c in e) "default" !== c && {}.hasOwnProperty.call(e, c) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, c)) && (i.get || i.set) ? o(s, c, i) : s[c] = e[c]);
      return s;
    })(e, n);
  }
  var A = Object.assign({}, c.TransitionPresets.SlideFromRightIOS),
    M = Object.assign({
      headerShown: !1,
      cardOverlayEnabled: !1,
      gestureEnabled: !0,
      gestureResponseDistance: i.Dimensions.get('window').height / 2
    }, 'android' === i.Platform.OS ? c.TransitionPresets.BottomSheetAndroid : c.TransitionPresets.ModalPresentationIOS),
    N = 'ios' === i.Platform.OS ? {
      gestureResponseDistance: {
        horizontal: (0, j.normalize)(200),
        vertical: (0, j.normalize)(400)
      }
    } : {},
    I = (0, c.createStackNavigator)(),
    R = function () {
      return (0, _.jsxs)(I.Navigator, {
        initialRouteName: 'Welcome',
        screenOptions: A,
        children: [(0, _.jsx)(I.Screen, {
          name: "Welcome",
          component: O.Welcome,
          options: Object.assign({}, N, {
            header: function () {
              return null;
            }
          })
        }), (0, _.jsx)(I.Screen, {
          name: "OurApproach",
          component: U,
          options: Object.assign({}, N, {
            header: function () {
              return null;
            }
          })
        }), (0, _.jsx)(I.Screen, {
          name: "ReadyToStart",
          component: O.ReadyToStart,
          options: Object.assign({}, N, {
            header: function () {
              return null;
            }
          })
        }), (0, _.jsx)(I.Screen, {
          name: "PreviewCard1",
          component: O.PreviewCard.Level1,
          options: Object.assign({}, N, {
            header: function () {
              return null;
            }
          })
        }), (0, _.jsx)(I.Screen, {
          name: "PreviewCard2",
          component: O.PreviewCard.Level2,
          options: Object.assign({}, N, {
            header: function () {
              return null;
            }
          })
        }), (0, _.jsx)(I.Screen, {
          name: "PreviewCard3",
          component: O.PreviewCard.Level3,
          options: Object.assign({}, N, {
            header: function () {
              return null;
            }
          })
        }), (0, _.jsx)(I.Screen, {
          name: "PreviewCard4",
          component: O.PreviewCard.Level4,
          options: Object.assign({}, N, {
            header: function () {
              return null;
            }
          })
        }), (0, _.jsx)(I.Screen, {
          name: "Great",
          component: O.Great,
          options: Object.assign({}, N, {
            header: function () {
              return null;
            }
          })
        }), (0, _.jsx)(I.Screen, {
          name: "SelectLevel",
          component: O.SelectLevel,
          options: Object.assign({}, N, {
            header: function () {
              return null;
            }
          })
        }), (0, _.jsx)(I.Screen, {
          name: "SelectAmountCards",
          component: O.SelectAmountCards,
          options: Object.assign({}, N, {
            header: function () {
              return null;
            }
          })
        }), (0, _.jsx)(I.Screen, {
          name: "SelectApproachToLearning",
          component: O.SelectApproachToLearning,
          options: Object.assign({}, N, {
            header: function () {
              return null;
            }
          })
        }), (0, _.jsx)(I.Screen, {
          name: "MarketingSurvey",
          component: v.MarketingSurvey,
          options: Object.assign({}, N, {
            header: function () {
              return null;
            }
          })
        })]
      });
    },
    E = (0, c.createStackNavigator)(),
    D = function () {
      return (0, _.jsxs)(E.Navigator, {
        initialRouteName: 'SignUp',
        screenOptions: A,
        children: [(0, _.jsx)(E.Screen, {
          name: "SignIn",
          component: b.SignIn,
          options: Object.assign({}, N, {
            header: function () {
              return null;
            }
          })
        }), (0, _.jsx)(E.Screen, {
          name: "SignUp",
          component: b.SignUp,
          options: Object.assign({}, N, {
            header: function () {
              return null;
            }
          })
        }), (0, _.jsx)(E.Screen, {
          name: "RestorePassword",
          component: b.RestorePassword,
          options: Object.assign({}, N, {
            header: function () {
              return null;
            }
          })
        }), (0, _.jsx)(E.Screen, {
          name: "GreatContinue",
          component: b.GreatContinue,
          options: Object.assign({}, N, {
            header: function () {
              return null;
            }
          })
        }), (0, _.jsx)(E.Group, {
          screenOptions: Object.assign({
            presentation: 'modal'
          }, M),
          children: (0, _.jsx)(E.Screen, {
            name: "NoSync",
            component: k.default,
            options: {
              header: function () {
                return null;
              }
            }
          })
        })]
      });
    },
    W = (0, c.createStackNavigator)(),
    L = function () {
      var e = (0, o.useSelector)(function (e) {
        return e.settings.marketing_survey_seen;
      });
      return (0, _.jsxs)(W.Navigator, {
        initialRouteName: e ? 'TopicsToLearn' : 'MarketingSurvey',
        screenOptions: A,
        children: [(0, _.jsx)(W.Screen, {
          name: "TopicsToLearn",
          component: v.TopicsToLearn,
          options: Object.assign({}, N, {
            header: function () {
              return null;
            }
          })
        }), (0, _.jsx)(W.Screen, {
          name: "StudyCards",
          component: v.StudyCards,
          options: Object.assign({}, N, {
            header: function () {
              return null;
            }
          })
        }), (0, _.jsx)(W.Screen, {
          name: "StudyCardsWithVeil",
          component: v.StudyCardsWithVeil,
          options: Object.assign({}, N, {
            header: function () {
              return null;
            }
          })
        }), (0, _.jsx)(W.Screen, {
          name: "GreatJob",
          component: v.GreatJob,
          options: Object.assign({}, N, {
            header: function () {
              return null;
            }
          })
        }), (0, _.jsx)(W.Screen, {
          name: "Settings",
          component: v.Settings,
          options: Object.assign({}, N, {
            header: function () {
              return null;
            }
          })
        }), (0, _.jsx)(W.Screen, {
          name: "Account",
          component: v.Account,
          options: Object.assign({}, N, {
            header: function () {
              return null;
            }
          })
        }), (0, _.jsx)(W.Screen, {
          name: "StudySettings",
          component: v.StudySettings,
          options: Object.assign({}, N, {
            header: function () {
              return null;
            }
          })
        }), (0, _.jsx)(W.Screen, {
          name: "ReminderSetting",
          component: v.ReminderSetting,
          options: Object.assign({}, N, {
            header: function () {
              return null;
            }
          })
        }), (0, _.jsx)(W.Screen, {
          name: "TipOfTheDay",
          component: v.TipOfTheDay,
          options: Object.assign({}, N, {
            header: function () {
              return null;
            }
          })
        }), (0, _.jsx)(W.Screen, {
          name: "EndOfTrial",
          component: v.EndOfTrial,
          options: Object.assign({}, N, {
            header: function () {
              return null;
            }
          })
        }), (0, _.jsx)(W.Screen, {
          name: "Subscriptions",
          component: v.Subscriptions,
          options: Object.assign({}, N, {
            header: function () {
              return null;
            }
          })
        }), (0, _.jsx)(W.Screen, {
          name: "Survey",
          component: v.Survey,
          options: Object.assign({}, N, {
            header: function () {
              return null;
            }
          })
        }), (0, _.jsx)(W.Screen, {
          name: "SurveyExtra",
          component: v.SurveyExtra,
          options: Object.assign({}, N, {
            header: function () {
              return null;
            }
          })
        }), (0, _.jsx)(W.Screen, {
          name: "MarketingSurvey",
          component: v.MarketingSurvey,
          options: Object.assign({}, N, {
            header: function () {
              return null;
            }
          }),
          initialParams: {
            isExistingUser: !0
          }
        }), (0, _.jsx)(W.Screen, {
          name: "FAQ",
          component: v.FAQ,
          options: Object.assign({}, N, {
            header: function () {
              return null;
            }
          })
        })]
      });
    },
    F = (0, c.createStackNavigator)(),
    U = function () {
      return (0, _.jsx)(F.Navigator, {
        initialRouteName: 'MjolnirWay',
        screenOptions: A,
        children: (0, _.jsx)(F.Screen, {
          name: "MjolnirWay",
          component: x.MjolnirWay,
          options: Object.assign({}, N, {
            header: function () {
              return null;
            }
          })
        })
      });
    },
    G = (0, c.createStackNavigator)(),
    V = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  (0, u.default)().setBackgroundMessageHandler(function () {
    var e = (0, t.default)(function* (e) {
      __DEV__ && console.log('Message handled in the background!', e);
    });
    return function (n) {
      return e.apply(this, arguments);
    };
  }());
  _e.default = (0, o.connect)(function (e) {
    return {
      profile: e.auth.profile,
      passedOnboarding: e.deckStats.passed_onboarding,
      completedSessions: e.deckStats.completed_sessions,
      mode: e.settings.theme,
      studySettings: e.settings.study_settings
    };
  }, function (e) {
    return {
      setSubscriptionPurchased: function (n) {
        return e((0, w.setSubscriptionPurchased)(n));
      },
      setPaywallVisible: function (n) {
        return e((0, w.setPaywallVisible)(n));
      }
    };
  })(function (e) {
    var o = e.mode,
      c = e.studySettings,
      j = e.passedOnboarding,
      O = e.completedSessions,
      b = e.profile,
      v = e.setSubscriptionPurchased,
      x = e.setPaywallVisible;
    (0, r.useEffect)(function () {
      y.default.setType(o);
    }, [o]), (0, r.useEffect)(function () {
      var e = (0, S.default)().onAuthStateChanged(function () {
        var e = (0, t.default)(function* (e) {
          var n = null;
          if (null != e && e.uid ? n = e.uid : null != b && b.uid && (n = b.uid), null !== n) {
            yield (0, h.default)().setUserId(n), (yield p.default.isConfigured()) ? yield p.default.logIn(n) : yield p.default.configure({
              apiKey: 'ios' === i.Platform.OS ? 'appl_SYUeXWkdMNiVOOfUcNGqLCYKRaQ' : 'goog_IMXFjpbldzAYuozWikSmUYUTMXW',
              appUserID: n
            });
            var t = yield p.default.getCustomerInfo();
            if (t.activeSubscriptions.length > 0) {
              var r = t.activeSubscriptions[0],
                o = t.allExpirationDates[r],
                s = '',
                c = !1;
              (0, f.default)().isAfter((0, f.default)(o)) ? (s = 'Expired on', c = !0) : P.monthlySubscriptionIDs.indexOf(r) > -1 ? s = 'Monthly, renews on' : P.yearlySubscriptionIDs.indexOf(r) > -1 && (s = 'Yearly, renews on'), x(c), v(`${s} ${(0, f.default)(o).calendar()}`);
            }
          }
        });
        return function (n) {
          return e.apply(this, arguments);
        };
      }());
      return e;
    }, []), (0, r.useEffect)(function () {
      w();
    }, []), (0, r.useEffect)(function () {
      A();
    }, [c]), (0, r.useEffect)(function () {
      var e = (0, u.default)().onMessage(function () {
        var e = (0, t.default)(function* (e) {
          k(e.notification.title, e.notification.body);
        });
        return function (n) {
          return e.apply(this, arguments);
        };
      }());
      return (0, u.default)().onNotificationOpenedApp(function (e) {
        __DEV__ && console.log('Notification caused app to open from background state:', e.notification);
      }), e;
    }, [k]);
    var w = function () {
        var e = (0, t.default)(function* () {
          var e = yield (0, u.default)().requestPermission(),
            n = e === u.default.AuthorizationStatus.AUTHORIZED || e === u.default.AuthorizationStatus.PROVISIONAL;
          'ios' === i.Platform.OS && (yield l.default.requestPermission()), n && (yield (0, u.default)().getToken());
        });
        return function () {
          return e.apply(this, arguments);
        };
      }(),
      k = (0, r.useCallback)(function () {
        var e = (0, t.default)(function* (e, n) {
          var t = yield l.default.createChannel({
            id: 'default',
            name: 'Default Channel'
          });
          yield l.default.displayNotification({
            title: e,
            body: n,
            android: {
              channelId: t,
              smallIcon: 'ic_small_icon',
              color: '#246BFD',
              pressAction: {
                id: 'default'
              }
            }
          });
        });
        return function (n, t) {
          return e.apply(this, arguments);
        };
      }(), []),
      C = (0, r.useCallback)(function (e) {
        return e.days.map(function (n) {
          var t = (0, f.default)().hour(e.hour).minute(e.minute).second(0),
            r = t.weekday(),
            o = V.indexOf(n) + 1;
          return o < r && (o += 7), t.weekday(o), {
            type: l.TriggerType.TIMESTAMP,
            timestamp: t.valueOf(),
            repeatFrequency: l.RepeatFrequency.WEEKLY
          };
        });
      }, []),
      A = (0, r.useCallback)((0, t.default)(function* () {
        var e = yield l.default.getTriggerNotificationIds();
        e.length > 0 && (yield l.default.cancelTriggerNotifications(e));
        var t = C(c.reminder1),
          r = C(c.reminder2),
          o = {
            title: 'Reminder',
            body: "It's time to learn Norwegian with Mj\xf8lnir!",
            android: {
              channelId: yield l.default.createChannel({
                id: 'default',
                name: 'Default Channel'
              }),
              smallIcon: 'ic_small_icon',
              color: '#246BFD',
              pressAction: {
                id: 'default'
              }
            }
          };
        Array.from([].concat((0, n.default)(t), (0, n.default)(r))).map(function (e) {
          return l.default.createTriggerNotification(o, e);
        });
      }), [C, c.reminder1, c.reminder2]),
      M = j || b.refreshToken,
      N = !b.refreshToken && 0 !== O;
    return (0, _.jsx)(s.NavigationContainer, {
      ref: T.navigationRef,
      theme: {
        colors: {
          background: y.default.getTheme().navigationRoot
        }
      },
      children: (0, _.jsx)(G.Navigator, {
        children: b.refreshToken || 0 === O ? M || N ? (0, _.jsxs)(_.Fragment, {
          children: [(0, _.jsx)(G.Screen, {
            name: "Main",
            component: L,
            options: {
              headerShown: !1,
              initialRouteName: N ? 'GreatJob' : 'TopicsToLearn'
            }
          }), (0, _.jsx)(G.Screen, {
            name: "OnBoarding",
            component: R,
            options: {
              headerShown: !1
            }
          }), (0, _.jsx)(G.Screen, {
            name: "Auth",
            component: D,
            options: {
              headerShown: !1
            }
          }), (0, _.jsx)(G.Screen, {
            name: "OurApproach",
            component: U,
            options: {
              headerShown: !1
            }
          })]
        }) : (0, _.jsxs)(_.Fragment, {
          children: [(0, _.jsx)(G.Screen, {
            name: "OnBoarding",
            component: R,
            options: {
              headerShown: !1
            }
          }), (0, _.jsx)(G.Screen, {
            name: "Main",
            component: L,
            options: {
              headerShown: !1
            }
          }), (0, _.jsx)(G.Screen, {
            name: "Auth",
            component: D,
            options: {
              headerShown: !1
            }
          }), (0, _.jsx)(G.Screen, {
            name: "OurApproach",
            component: U,
            options: {
              headerShown: !1
            }
          })]
        }) : (0, _.jsx)(G.Screen, {
          name: "Auth",
          component: D,
          options: {
            headerShown: !1
          }
        })
      })
    });
  });
}, 989, [1, 11, 68, 77, 892, 5, 990, 1085, 1168, 1189, 1219, 927, 1220, 1238, 1243, 1252, 1404, 2039, 2118, 2189, 2204, 1408, 2184, 2205, 80]);