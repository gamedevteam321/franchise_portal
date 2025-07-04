app_name = "franchise_portal"
app_title = "Franchise Portal"
app_publisher = "nexchar"
app_description = "Custom franchise signup interface"
app_email = "admin@nexcharventures.com"
app_license = "mit"

# Apps
# ------------------

# required_apps = []

# Each item in the list will be shown as an app in the apps page
# add_to_apps_screen = [
# 	{
# 		"name": "franchise_portal",
# 		"logo": "/assets/franchise_portal/logo.png",
# 		"title": "Franchise Portal",
# 		"route": "/franchise_portal",
# 		"has_permission": "franchise_portal.api.permission.has_app_permission"
# 	}
# ]

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/franchise_portal/css/franchise_portal.css"
app_include_js = "/assets/franchise_portal/js/franchise_portal.js"

# include js, css files in header of web template
# web_include_css = "/assets/franchise_portal/css/franchise_portal.css"
import os
import time

# Get the modification time of the signup.js file for cache busting
signup_js_path = os.path.join(os.path.dirname(__file__), 'public', 'js', 'signup.js')
if os.path.exists(signup_js_path):
    mod_time = int(os.path.getmtime(signup_js_path))
else:
    mod_time = int(time.time())

web_include_js = f"/assets/franchise_portal/js/signup.js?v={mod_time}"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "franchise_portal/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
doctype_js = {"Franchise Signup Application" : "public/js/franchise_signup_application.js"}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "franchise_portal/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "franchise_portal.utils.jinja_methods",
# 	"filters": "franchise_portal.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "franchise_portal.install.before_install"
# after_install = "franchise_portal.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "franchise_portal.uninstall.before_uninstall"
# after_uninstall = "franchise_portal.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "franchise_portal.utils.before_app_install"
# after_app_install = "franchise_portal.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "franchise_portal.utils.before_app_uninstall"
# after_app_uninstall = "franchise_portal.utils.after_app_uninstall"

# Auto-migrate on startup
# ----------
# auto_migrate = True

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "franchise_portal.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# DocType Class
# ---------------
# Override standard doctype classes

# override_doctype_class = {
# 	"ToDo": "custom_app.overrides.CustomToDo"
# }

# Document Events
# ---------------
# Hook on document methods and events

# doc_events = {
# 	"*": {
# 		"on_update": "method",
# 		"on_cancel": "method",
# 		"on_trash": "method"
# 	}
# }

# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"franchise_portal.tasks.all"
# 	],
# 	"daily": [
# 		"franchise_portal.tasks.daily"
# 	],
# 	"hourly": [
# 		"franchise_portal.tasks.hourly"
# 	],
# 	"weekly": [
# 		"franchise_portal.tasks.weekly"
# 	],
# 	"monthly": [
# 		"franchise_portal.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "franchise_portal.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "franchise_portal.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "franchise_portal.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["franchise_portal.utils.before_request"]
# after_request = ["franchise_portal.utils.after_request"]

# Job Events
# ----------
# before_job = ["franchise_portal.utils.before_job"]
# after_job = ["franchise_portal.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"franchise_portal.auth.validate"
# ]

# Automatically update python controller files with type annotations for Frappe 15+
# tsconfigjson_template = "franchise_portal/public/build.json"

# Fixtures
# --------
fixtures = ["Franchise Signup Application"]
  
