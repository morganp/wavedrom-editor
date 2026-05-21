package com.example.wavedrom;

import com.atlassian.templaterenderer.TemplateRenderer;

import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

/**
 * Serves a standalone editor page at /plugins/servlet/wavedrom/editor.
 *
 * Query params:
 *   initial   — current WaveDrom JSON (URL-encoded)
 *   contentId — Confluence page ID (for REST API save from dialog.js)
 */
public class WavedromEditorServlet extends HttpServlet {

    private final TemplateRenderer templateRenderer;

    public WavedromEditorServlet(TemplateRenderer templateRenderer) {
        this.templateRenderer = templateRenderer;
    }

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        resp.setContentType("text/html;charset=UTF-8");
        resp.setHeader("X-Frame-Options", "SAMEORIGIN");

        Map<String, Object> context = new HashMap<>();
        context.put("initial",   req.getParameter("initial")   != null ? req.getParameter("initial")   : "{}");
        context.put("contentId", req.getParameter("contentId") != null ? req.getParameter("contentId") : "");

        templateRenderer.render("templates/editor-page.vm", context, resp.getWriter());
    }
}
