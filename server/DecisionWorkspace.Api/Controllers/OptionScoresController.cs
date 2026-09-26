using Microsoft.AspNetCore.Mvc;
using DecisionWorkspace.Api.Contracts;
using DecisionWorkspace.Api.Services;
using DecisionWorkspace.Api.Models;

namespace DecisionWorkspace.Api.Controllers;

[Route("api/decision-options/{decisionOptionId:guid}/scores")]
[ApiController]
public class OptionScoresController : ControllerBase
{
    private readonly OptionScoreService _optionScoreService;

    public OptionScoresController(OptionScoreService optionScoreService)
    {
        _optionScoreService = optionScoreService;
    }

    [HttpPost]
    public async Task<IActionResult> CreateOptionScoreAsync(Guid decisionOptionId, [FromBody] CreateOptionScoreRequest request)
    {
        var optionScore = await _optionScoreService.CreateOptionScoreAsync(decisionOptionId, request);

        if (optionScore == null)
        {
            return NotFound();
        }

        return Ok(optionScore);
    }

    [HttpGet]
    public async Task<IActionResult> GetOptionScoreByDecisionId(Guid decisionOptionId)
    {
        var optionScore = await _optionScoreService.GetByDecisionOptionIdAsync(decisionOptionId);

        if (optionScore == null)
        {
            return NotFound();
        }

        return Ok(optionScore);
    }

}