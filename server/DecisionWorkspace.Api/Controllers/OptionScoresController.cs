using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using DecisionWorkspace.Api.Contracts;
using DecisionWorkspace.Api.Services;

namespace DecisionWorkspace.Api.Controllers;

[Route("api/decision-options/{decisionOptionId:guid}/scores")]
[ApiController]
[Authorize]
public class OptionScoresController : ControllerBase
{
    private readonly OptionScoreService _optionScoreService;

    public OptionScoresController(
        OptionScoreService optionScoreService
    )
    {
        _optionScoreService = optionScoreService;
    }

    private Guid GetUserId()
    {
        var userId = User.FindFirst("sub")?.Value;

        if (!Guid.TryParse(userId, out var parsedUserId))
        {
            throw new UnauthorizedAccessException("Invalid user ID.");
        }

        return parsedUserId;
    }

    [HttpPost]
    public async Task<IActionResult> CreateOptionScoreAsync(
        Guid decisionOptionId,
        [FromBody] CreateOptionScoreRequest request
    )
    {
        var optionScore =
            await _optionScoreService.CreateOptionScoreAsync(
                GetUserId(),
                decisionOptionId,
                request
            );

        if (optionScore == null)
        {
            return NotFound();
        }

        return Ok(optionScore);
    }

    [HttpGet]
    public async Task<IActionResult> GetOptionScoreByDecisionId(
        Guid decisionOptionId
    )
    {
        var optionScores =
            await _optionScoreService.GetByDecisionOptionIdAsync(
                GetUserId(),
                decisionOptionId
            );

        if (optionScores == null)
        {
            return NotFound();
        }

        return Ok(optionScores);
    }
}